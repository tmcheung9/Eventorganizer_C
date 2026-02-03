/*
  # Auto-populate contact_events when registrations are created

  ## Overview
  This migration creates a trigger that automatically adds entries to the contact_events
  junction table whenever a registration is created. This ensures that contacts are
  automatically associated with events they register for.

  1. Changes
    - Create a function to handle the trigger logic
    - Create a trigger on the registrations table
    - Backfill existing registrations into contact_events
    
  2. Behavior
    - When a new registration is created, automatically create a contact_events entry
    - Uses ON CONFLICT DO NOTHING to avoid duplicate entries
    - Ensures contacts always show up in event filters when they register
*/

-- Create function to auto-populate contact_events
CREATE OR REPLACE FUNCTION auto_populate_contact_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the event_id from the event_date
  INSERT INTO contact_events (contact_id, event_id)
  SELECT NEW.contact_id, ed.event_id
  FROM event_dates ed
  WHERE ed.id = NEW.event_date_id
  ON CONFLICT (contact_id, event_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on registrations table
DROP TRIGGER IF EXISTS trigger_auto_populate_contact_events ON registrations;
CREATE TRIGGER trigger_auto_populate_contact_events
  AFTER INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_contact_events();

-- Backfill existing registrations into contact_events
INSERT INTO contact_events (contact_id, event_id)
SELECT DISTINCT r.contact_id, ed.event_id
FROM registrations r
JOIN event_dates ed ON r.event_date_id = ed.id
ON CONFLICT (contact_id, event_id) DO NOTHING;