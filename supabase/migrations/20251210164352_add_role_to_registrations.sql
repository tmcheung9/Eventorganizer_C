/*
  # Add role field to registrations table

  1. Changes
    - Add `role` column to `registrations` table with default value 'attendee'
    - This allows each registration to have its own role (attendee/helper)
    - A person can be a helper in one event and an attendee in another
    
  2. Data Migration
    - Populate existing registrations' role field based on their contact's role
    - Future registrations will set role per-registration instead of relying on contact's fixed role
    
  3. Notes
    - The contact's role field will be kept for backward compatibility but registration's role takes precedence
    - This provides flexibility: same person can have different roles in different events
*/

-- Add role column to registrations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'role'
  ) THEN
    ALTER TABLE registrations ADD COLUMN role text DEFAULT 'attendee';
  END IF;
END $$;

-- Populate existing registrations with role from their contact
UPDATE registrations r
SET role = c.role
FROM contacts c
WHERE r.contact_id = c.id AND r.role IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_registrations_role ON registrations(role);