/*
  # Add sequence field to registrations table

  1. Changes
    - Add `display_sequence` column to `registrations` table
      - Type: integer
      - Default: 0
      - Used to store custom display order for registration rows
  
  2. Notes
    - This enables manual drag-and-drop reordering of registrations in the UI
    - Sequence is per contact within an event, allowing users to organize their view
    - Default value of 0 means rows will initially maintain their current order
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'display_sequence'
  ) THEN
    ALTER TABLE registrations ADD COLUMN display_sequence integer DEFAULT 0;
  END IF;
END $$;
