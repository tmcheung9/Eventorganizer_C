/*
  # Create contact-events junction table

  ## Overview
  This migration creates a many-to-many relationship between contacts and events,
  allowing contacts to be associated with multiple events/activities.

  1. New Tables
    - `contact_events`
      - `id` (uuid, primary key) - Unique identifier for the relationship
      - `contact_id` (uuid, foreign key) - References contacts table
      - `event_id` (uuid, foreign key) - References events table
      - `created_at` (timestamptz) - When the association was created
      - Unique constraint on (contact_id, event_id) to prevent duplicates

  2. Security
    - Enable RLS on `contact_events` table
    - Add policies for public read access (consistent with existing tables)
    - Add policies for public insert/update/delete access

  3. Indexes
    - Index on contact_id for efficient lookups
    - Index on event_id for efficient lookups
*/

-- Create contact_events junction table
CREATE TABLE IF NOT EXISTS contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, event_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contact_events_contact_id ON contact_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_event_id ON contact_events(event_id);

-- Enable RLS
ALTER TABLE contact_events ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to contact_events"
  ON contact_events FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to contact_events"
  ON contact_events FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to contact_events"
  ON contact_events FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to contact_events"
  ON contact_events FOR DELETE
  TO public
  USING (true);