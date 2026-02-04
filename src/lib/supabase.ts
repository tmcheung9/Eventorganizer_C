import { createClient } from '@supabase/supabase-js';

function initSupabase() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = initSupabase();

export type Contact = {
  id: string;
  name: string;
  faith_status: string;
  source_group: string;
  group_name: string;
  notes: string;
  is_believer: boolean;
  role: string;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type EventDate = {
  id: string;
  event_id: string;
  event_date: string;
  created_at: string;
};

export type Registration = {
  id: string;
  contact_id: string;
  event_date_id: string;
  registration_status: string;
  registration_type: string;
  position: string;
  role: string;
  display_sequence: number;
  registration_sequence: number;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  registration_id: string;
  attended: boolean;
  attendance_date: string;
  notes: string;
  created_at: string;
};

export type FollowUp = {
  id: string;
  contact_id: string;
  event_date_id: string | null;
  group_leader: string;
  seeker_status: string;
  seeker_status_details: string;
  participation_score: number | null;
  participation_notes: string;
  inquiry_status: string;
  inquiry_status_other: string;
  participation_enthusiasm_score: number;
  participation_enthusiasm_notes: string;
  status: string;
  responsible_person: string;
  next_follow_up_date: string | null;
  action_notes: string;
  created_at: string;
  updated_at: string;
};
