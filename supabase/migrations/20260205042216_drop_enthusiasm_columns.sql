/*
  # Remove Enthusiasm Score Fields from Follow-ups Table

  ## Changes Made

  This migration removes the enthusiasm scoring fields from the follow_ups table as these fields are no longer being used in the application.

  1. **Columns Removed**
    - `participation_enthusiasm_score` - Previously stored enthusiasm scores (1-5)
    - `participation_enthusiasm_notes` - Previously stored notes about enthusiasm

  2. **Important Notes**
    - The "觀察筆記" (participation_notes) field is **kept unchanged** as it is still actively used
    - These fields are being permanently removed from the database
    - Data in these fields will be lost after this migration
*/

-- Drop enthusiasm score columns from follow_ups table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_ups' AND column_name = 'participation_enthusiasm_score'
  ) THEN
    ALTER TABLE follow_ups DROP COLUMN participation_enthusiasm_score;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_ups' AND column_name = 'participation_enthusiasm_notes'
  ) THEN
    ALTER TABLE follow_ups DROP COLUMN participation_enthusiasm_notes;
  END IF;
END $$;