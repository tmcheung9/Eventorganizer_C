/*
  # Fix Empty Contact Roles

  1. Updates
    - Updates all contacts with empty or NULL roles to match their most recent registration role
    - Ensures contacts.role is consistent with their registrations.role
    - Fixes issue where contacts with empty roles don't appear in follow-up management

  2. Implementation
    - Finds contacts with NULL or empty string roles
    - Looks up the most recent registration for each contact
    - Updates the contact's role to match the registration's role
    - Only updates contacts that have at least one registration

  3. Important Notes
    - This is a one-time fix for existing data
    - Future registrations will automatically sync via the existing trigger
    - Contacts without any registrations will keep their empty role
*/

-- Update contacts with empty roles to match their most recent registration
UPDATE contacts c
SET 
  role = (
    SELECT r.role
    FROM registrations r
    WHERE r.contact_id = c.id
      AND r.role IS NOT NULL
      AND r.role != ''
    ORDER BY r.created_at DESC
    LIMIT 1
  ),
  updated_at = NOW()
WHERE (c.role IS NULL OR c.role = '')
  AND EXISTS (
    SELECT 1 
    FROM registrations r 
    WHERE r.contact_id = c.id
      AND r.role IS NOT NULL
      AND r.role != ''
  );
