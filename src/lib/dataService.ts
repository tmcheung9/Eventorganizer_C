import { supabase, Contact, Event, EventDate, Registration, Attendance } from './supabase';

export type RegistrationWithDetails = Registration & {
  contact: Contact;
  event_date: EventDate & { event: Event };
  attendance: Attendance | null;
};

export async function loadAllData() {
  const [
    { data: regsData, error: regsError },
    { data: contactsData, error: contactsError },
    { data: eventsData, error: eventsError },
    { data: datesData, error: datesError },
    { data: attendanceData, error: attendanceError }
  ] = await Promise.all([
    supabase.from('registrations').select('*'),
    supabase.from('contacts').select('*'),
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('event_dates').select('*').order('event_date'),
    supabase.from('attendance').select('*')
  ]);

  if (regsError) throw regsError;
  if (contactsError) throw contactsError;
  if (eventsError) throw eventsError;
  if (datesError) throw datesError;
  if (attendanceError) throw attendanceError;

  const contactMap = new Map(contactsData?.map(c => [c.id, c]) || []);
  const eventMap = new Map(eventsData?.map(e => [e.id, e]) || []);
  const dateMap = new Map(datesData?.map(d => [d.id, d]) || []);
  const attendanceMap = new Map(attendanceData?.map(a => [a.registration_id, a]) || []);

  const regsWithDetails = (regsData || []).map(reg => {
    const contact = contactMap.get(reg.contact_id);
    const eventDate = dateMap.get(reg.event_date_id);
    const event = eventDate ? eventMap.get(eventDate.event_id) : null;
    const attendance = attendanceMap.get(reg.id) || null;

    return {
      ...reg,
      contact: contact!,
      event_date: { ...eventDate!, event: event! },
      attendance
    };
  });

  return {
    registrations: regsWithDetails,
    contacts: contactsData || [],
    events: eventsData || [],
    eventDates: datesData || [],
    attendance: attendanceData || []
  };
}

export function extractFilterOptions(contacts: Contact[], registrations: Registration[]) {
  const faithStatuses = [...new Set(contacts.map(c => c.faith_status).filter(Boolean))].sort();
  const sourceGroups = [...new Set(contacts.map(c => c.source_group).filter(Boolean))].sort();
  const positions = [...new Set(registrations.map(r => r.position).filter(Boolean))].sort();
  const groupNames = [...new Set(contacts.map(c => c.group_name).filter(Boolean))].sort();

  return { faithStatuses, sourceGroups, positions, groupNames };
}
