/*
  # Add registration_sequence field for independent Registration page ordering

  1. Changes
    - Add `registration_sequence` column to `registrations` table
      - Type: integer
      - Default: 0
      - Used to store custom display order specifically for Registration page
  
  2. Notes
    - This field is completely independent from `display_sequence` (used by Attendance page)
    - Registration page and Attendance page now maintain separate, independent orderings
    - The `display_sequence` field continues to be used exclusively by the Attendance page
    - The `registration_sequence` field is used exclusively by the Registration page
    - Changes to ordering in one page will NOT affect the ordering in the other page
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'registration_sequence'
  ) THEN
    ALTER TABLE registrations ADD COLUMN registration_sequence integer DEFAULT 0;
  END IF;
END $$;