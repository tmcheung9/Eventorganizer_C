/*
  # Security Fixes

  1. Function Search Path Security
    - Fix mutable search_path in all functions by setting explicit search_path
    - This prevents malicious functions from being in the search path
    
  2. RLS Policy Improvements
    - Explicitly scope policies to anon, authenticated roles
    - Keep permissive policies for internal church app without auth
*/

-- ============================================================================
-- FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Fix: auto_populate_contact_events
CREATE OR REPLACE FUNCTION auto_populate_contact_events()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO contact_events (contact_id, event_id)
  SELECT NEW.contact_id, ed.event_id
  FROM event_dates ed
  WHERE ed.id = NEW.event_date_id
  ON CONFLICT (contact_id, event_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix: sync_contact_role_from_registration
CREATE OR REPLACE FUNCTION sync_contact_role_from_registration()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contacts
  SET role = NEW.role,
      updated_at = NOW()
  WHERE id = NEW.contact_id
    AND NEW.role IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX RLS POLICIES
-- ============================================================================

-- CONTACTS
DROP POLICY IF EXISTS "允許公開查看聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許公開新增聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許公開更新聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許公開刪除聯絡人" ON contacts;

CREATE POLICY "允許查看聯絡人"
  ON contacts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增聯絡人"
  ON contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新聯絡人"
  ON contacts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除聯絡人"
  ON contacts FOR DELETE
  TO anon, authenticated
  USING (true);

-- EVENTS
DROP POLICY IF EXISTS "允許公開查看活動" ON events;
DROP POLICY IF EXISTS "允許公開新增活動" ON events;
DROP POLICY IF EXISTS "允許公開更新活動" ON events;
DROP POLICY IF EXISTS "允許公開刪除活動" ON events;

CREATE POLICY "允許查看活動"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增活動"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新活動"
  ON events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除活動"
  ON events FOR DELETE
  TO anon, authenticated
  USING (true);

-- EVENT_DATES
DROP POLICY IF EXISTS "允許公開查看活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許公開新增活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許公開更新活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許公開刪除活動日期" ON event_dates;

CREATE POLICY "允許查看活動日期"
  ON event_dates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增活動日期"
  ON event_dates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新活動日期"
  ON event_dates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除活動日期"
  ON event_dates FOR DELETE
  TO anon, authenticated
  USING (true);

-- REGISTRATIONS
DROP POLICY IF EXISTS "允許公開查看登記" ON registrations;
DROP POLICY IF EXISTS "允許公開新增登記" ON registrations;
DROP POLICY IF EXISTS "允許公開更新登記" ON registrations;
DROP POLICY IF EXISTS "允許公開刪除登記" ON registrations;

CREATE POLICY "允許查看登記"
  ON registrations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增登記"
  ON registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新登記"
  ON registrations FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除登記"
  ON registrations FOR DELETE
  TO anon, authenticated
  USING (true);

-- ATTENDANCE
DROP POLICY IF EXISTS "允許公開查看出席" ON attendance;
DROP POLICY IF EXISTS "允許公開新增出席" ON attendance;
DROP POLICY IF EXISTS "允許公開更新出席" ON attendance;
DROP POLICY IF EXISTS "允許公開刪除出席" ON attendance;

CREATE POLICY "允許查看出席"
  ON attendance FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增出席"
  ON attendance FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新出席"
  ON attendance FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除出席"
  ON attendance FOR DELETE
  TO anon, authenticated
  USING (true);

-- FOLLOW_UPS
DROP POLICY IF EXISTS "允許公開查看跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許公開新增跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許公開更新跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許公開刪除跟進" ON follow_ups;

CREATE POLICY "允許查看跟進"
  ON follow_ups FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "允許新增跟進"
  ON follow_ups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "允許更新跟進"
  ON follow_ups FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許刪除跟進"
  ON follow_ups FOR DELETE
  TO anon, authenticated
  USING (true);

-- CONTACT_EVENTS
DROP POLICY IF EXISTS "Allow public read access to contact_events" ON contact_events;
DROP POLICY IF EXISTS "Allow public insert access to contact_events" ON contact_events;
DROP POLICY IF EXISTS "Allow public update access to contact_events" ON contact_events;
DROP POLICY IF EXISTS "Allow public delete access to contact_events" ON contact_events;

CREATE POLICY "Allow read access to contact_events"
  ON contact_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert access to contact_events"
  ON contact_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to contact_events"
  ON contact_events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete access to contact_events"
  ON contact_events FOR DELETE
  TO anon, authenticated
  USING (true);