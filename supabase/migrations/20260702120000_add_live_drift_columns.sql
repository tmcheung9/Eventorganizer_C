/*
  # Add columns present in the live (Bolt) database but missing from committed migrations

  The production database drifted from the repo migrations: several columns were
  added directly via the Bolt editor and never committed. This migration reconciles
  the schema so it matches production.

  1. registrations: group_name, position1, position2, position3
  2. follow_ups: group_leader, seeker_status, seeker_status_details,
     participation_score, participation_notes, inquiry_status, inquiry_status_other
*/

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS group_name text DEFAULT '';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS position1 text DEFAULT '';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS position2 text DEFAULT '';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS position3 text DEFAULT '';

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS group_leader text DEFAULT '';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS seeker_status text DEFAULT '';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS seeker_status_details text DEFAULT '';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS participation_score integer;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS participation_notes text DEFAULT '';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS inquiry_status text DEFAULT '';
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS inquiry_status_other text DEFAULT '';
