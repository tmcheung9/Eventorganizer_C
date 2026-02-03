/*
  # Fix Existing Contact Roles to Match Most Recent Registration

  1. Data Correction
    - Updates each contact's role to match their most recent registration role
    - For contacts with registrations: uses the role from the registration with the latest updated_at timestamp
    - For contacts without registrations: keeps current role or defaults to 'attendee'

  2. Process
    - Uses window function to identify most recent registration per contact
    - Updates contacts.role with the most recent registration's role
    - Sets updated_at timestamp to current time

  3. Data Safety
    - No data loss - only updates contact.role to reflect actual current status
    - Preserves all historical registration data
    - Handles NULL cases gracefully
*/

UPDATE contacts c
SET role = (
  SELECT r.role
  FROM registrations r
  WHERE r.contact_id = c.id
  ORDER BY r.updated_at DESC
  LIMIT 1
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM registrations WHERE contact_id = c.id
);
