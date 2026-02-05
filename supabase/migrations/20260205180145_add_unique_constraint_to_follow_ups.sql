/*
  # Add Unique Constraint to Follow-Ups Table

  1. Changes
    - Add unique constraint on follow_ups(contact_id) to ensure each contact has only one follow-up record
    - This prevents duplicate follow-up records from being created in the future
  
  2. Security
    - No changes to RLS policies
    - This is a data integrity constraint only
*/

-- Add unique constraint to prevent duplicate follow-up records per contact
ALTER TABLE follow_ups
ADD CONSTRAINT follow_ups_contact_id_unique UNIQUE (contact_id);
