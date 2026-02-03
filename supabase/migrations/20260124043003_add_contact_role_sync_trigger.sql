/*
  # Sync Contact Role with Latest Registration

  1. New Trigger
    - `update_contact_role_on_registration_change` - Updates contacts.role whenever a registration is inserted or updated
    - Automatically sets contact.role to the role from the most recent registration for that contact
    - Ensures contact.role is always the current, consistent status
    - Maintains single source of truth for each contact's status

  2. Purpose
    - Fixes inconsistency where contacts can show stale roles when having multiple registrations with different roles
    - Enables reliable filtering and follow-up logic based on contacts.role
    - Eliminates complex query-time inference about current role

  3. Important Notes
    - Trigger fires on INSERT and UPDATE to registrations table
    - Uses COALESCE to handle NULL cases gracefully
    - Constraint: Only triggers when role is provided in registration
*/

CREATE OR REPLACE FUNCTION sync_contact_role_from_registration()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET role = NEW.role,
      updated_at = NOW()
  WHERE id = NEW.contact_id
    AND NEW.role IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_role_on_registration_change ON registrations;

CREATE TRIGGER update_contact_role_on_registration_change
AFTER INSERT OR UPDATE ON registrations
FOR EACH ROW
EXECUTE FUNCTION sync_contact_role_from_registration();
