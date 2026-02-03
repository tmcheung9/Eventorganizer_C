/*
  # Add group_name field to contacts table

  1. Changes
    - Add `group_name` column to `contacts` table
      - Type: text
      - Default: empty string
      - Purpose: Store the group/team classification for each contact (組別)

  2. Notes
    - This field allows manual entry of group classification
    - Can be used for filtering and organizing contacts
    - No RLS changes needed as contacts table already has proper policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE contacts ADD COLUMN group_name text DEFAULT '';
  END IF;
END $$;