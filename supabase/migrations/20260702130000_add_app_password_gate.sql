/*
  # App-level password gate (server-verified, no user accounts)

  Replaces the hardcoded client-side password check in App.tsx with a
  server-side check. The password itself is never shipped to the browser.

  1. New table `app_config` — holds a single row with the hashed app password.
     Locked down: no client (anon/authenticated) can SELECT it directly.
  2. New function `verify_app_password(input text)` — SECURITY DEFINER,
     compares the input against the stored hash using pgcrypto and returns
     true/false. Callable by anyone (anon), since this IS the login check,
     but it never exposes the hash itself.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No policies granted: table is unreadable/unwritable directly by anon/authenticated.
-- Only SECURITY DEFINER functions (owned by the table owner) can read it.

-- NOTE: the actual password hash is seeded separately (not committed here —
-- see the local, gitignored seed script) so the plaintext password never
-- lands in git history. To (re)set it manually:
--   UPDATE app_config SET value = crypt('<new password>', gen_salt('bf')), updated_at = now()
--   WHERE key = 'app_password_hash';

CREATE OR REPLACE FUNCTION verify_app_password(input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value INTO stored_hash FROM app_config WHERE key = 'app_password_hash';
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN stored_hash = crypt(input, stored_hash);
END;
$$;

REVOKE ALL ON FUNCTION verify_app_password(text) FROM public;
GRANT EXECUTE ON FUNCTION verify_app_password(text) TO anon, authenticated;
