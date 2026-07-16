import { useState, useEffect } from 'react';
import { Filter, Calendar, UserPlus, Download, FileText, Plus, Minus, ChevronLeft, ChevronRight, GripVertical, Save } from 'lucide-react';
import { supabase, Contact, Event, EventDate, Registration, Attendance } from '../lib/supabase';
import { loadAllData, extractFilterOptions, RegistrationWithDetails } from '../lib/dataService';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { parseLocalDate } from '../lib/dateUtils';

type GroupedAttendance = {
  contact: Contact;
  dates: Map<string, { registration: Registration; attendance: Attendance | null }>;
  displaySequence: number;
};

type ContactGroup = {
  groupName: string;
  contacts: Contact[];
  isCollapsed: boolean;
};

export function AttendanceTracking() {
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [selectedDateFilters, setSelectedDateFilters] = useState<string[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddContact, setQuickAddContact] = useState('');
  const [quickAddDate, setQuickAddDate] = useState('');
  const [attendeeFilters, setAttendeeFilters] = useState({
    name: '',
    faithStatus: '',
    sourceGroup: '',
    groupName: ''
  });
  const [helperFilters, setHelperFilters] = useState({
    name: '',
    sourceGroup: '',
    groupName: '',
    position: ''
  });
  const [faithStatusOptions, setFaithStatusOptions] = useState<string[]>([]);
  const [sourceGroupOptions, setSourceGroupOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [showFaithStatus, setShowFaithStatus] = useState(false);
  const [showAttendeeSourceGroup, setShowAttendeeSourceGroup] = useState(false);
  const [showHelperSourceGroup, setShowHelperSourceGroup] = useState(false);
  const [showGroupName, setShowGroupName] = useState(true);
  const [eventDatePage, setEventDatePage] = useState(0);
  const datesPerPage = 5;
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [tempGroupName, setTempGroupName] = useState('');
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [tempPosition, setTempPosition] = useState('');
  const [draggedAttendeeIndex, setDraggedAttendeeIndex] = useState<number | null>(null);
  const [draggedHelperIndex, setDraggedHelperIndex] = useState<number | null>(null);
  const [draggedAttendeeGroupName, setDraggedAttendeeGroupName] = useState<string | null>(null);
  const [draggedHelperGroupName, setDraggedHelperGroupName] = useState<string | null>(null);
  const [attendeeContacts, setAttendeeContacts] = useState<Contact[]>([]);
  const [helperContacts, setHelperContacts] = useState<Contact[]>([]);
  const [attendeeGroups, setAttendeeGroups] = useState<ContactGroup[]>([]);
  const [helperGroups, setHelperGroups] = useState<ContactGroup[]>([]);
  const [editingGroupHeader, setEditingGroupHeader] = useState<string | null>(null);
  const [tempGroupHeader, setTempGroupHeader] = useState('');
  const [draggedAttendeeGroupIndex, setDraggedAttendeeGroupIndex] = useState<number | null>(null);
  const [draggedHelperGroupIndex, setDraggedHelperGroupIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedDateFilters([]);
    setEventDatePage(0);
  }, [filterEvent]);

  useEffect(() => {
    const currentEvent = filterEvent !== 'all' ? events.find(e => e.id === filterEvent) : null;

    if (currentEvent) {
      const attendeeData = groupAttendanceByContact(
        registrations.filter(r => r.role === 'attendee'),
        currentEvent.id
      ).map(g => g.contact);

      const helperData = groupAttendanceByContact(
        registrations.filter(r => r.role === 'helper'),
        currentEvent.id
      ).map(g => g.contact);

      setAttendeeContacts(attendeeData);
      setHelperContacts(helperData);

      // Create groups with sequence-based ordering
      const attendeeGroupMap = new Map<string, { contacts: Contact[], minSequence: number }>();
      attendeeData.forEach(contact => {
        const groupName = contact.group_name || '未分組';
        if (!attendeeGroupMap.has(groupName)) {
          attendeeGroupMap.set(groupName, { contacts: [], minSequence: Infinity });
        }
        const group = attendeeGroupMap.get(groupName)!;
        group.contacts.push(contact);

        // Find min sequence for this group from registrations
        const contactRegs = registrations.filter(r =>
          r.contact_id === contact.id &&
          r.role === 'attendee' &&
          eventDates.find(d => d.id === r.event_date_id)?.event_id === currentEvent.id
        );
        const minSeq = Math.min(...contactRegs.map(r => r.display_sequence ?? Infinity));
        group.minSequence = Math.min(group.minSequence, minSeq);
      });

      const helperGroupMap = new Map<string, { contacts: Contact[], minSequence: number }>();
      helperData.forEach(contact => {
        const groupName = contact.group_name || '未分組';
        if (!helperGroupMap.has(groupName)) {
          helperGroupMap.set(groupName, { contacts: [], minSequence: Infinity });
        }
        const group = helperGroupMap.get(groupName)!;
        group.contacts.push(contact);

        // Find min sequence for this group from registrations
        const contactRegs = registrations.filter(r =>
          r.contact_id === contact.id &&
          r.role === 'helper' &&
          eventDates.find(d => d.id === r.event_date_id)?.event_id === currentEvent.id
        );
        const minSeq = Math.min(...contactRegs.map(r => r.display_sequence ?? Infinity));
        group.minSequence = Math.min(group.minSequence, minSeq);
      });

      // Preserve existing group order, only add new groups at the end
      const newAttendeeGroups: ContactGroup[] = [];
      const seenAttendeeGroups = new Set<string>();

      // First, add existing groups in their current order (if they still have contacts)
      attendeeGroups.forEach(existingGroup => {
        if (attendeeGroupMap.has(existingGroup.groupName)) {
          const groupData = attendeeGroupMap.get(existingGroup.groupName)!;
          newAttendeeGroups.push({
            groupName: existingGroup.groupName,
            contacts: groupData.contacts,
            isCollapsed: existingGroup.isCollapsed
          });
          seenAttendeeGroups.add(existingGroup.groupName);
        }
      });

      // Then, add any new groups that weren't in the previous state
      Array.from(attendeeGroupMap.entries())
        .filter(([groupName]) => !seenAttendeeGroups.has(groupName))
        .sort((a, b) => a[1].minSequence - b[1].minSequence)
        .forEach(([groupName, { contacts }]) => {
          newAttendeeGroups.push({
            groupName,
            contacts,
            isCollapsed: false
          });
        });

      const newHelperGroups: ContactGroup[] = [];
      const seenHelperGroups = new Set<string>();

      // First, add existing groups in their current order (if they still have contacts)
      helperGroups.forEach(existingGroup => {
        if (helperGroupMap.has(existingGroup.groupName)) {
          const groupData = helperGroupMap.get(existingGroup.groupName)!;
          newHelperGroups.push({
            groupName: existingGroup.groupName,
            contacts: groupData.contacts,
            isCollapsed: existingGroup.isCollapsed
          });
          seenHelperGroups.add(existingGroup.groupName);
        }
      });

      // Then, add any new groups that weren't in the previous state
      Array.from(helperGroupMap.entries())
        .filter(([groupName]) => !seenHelperGroups.has(groupName))
        .sort((a, b) => a[1].minSequence - b[1].minSequence)
        .forEach(([groupName, { contacts }]) => {
          newHelperGroups.push({
            groupName,
            contacts,
            isCollapsed: false
          });
        });

      setAttendeeGroups(newAttendeeGroups);
      setHelperGroups(newHelperGroups);
    } else {
      setAttendeeContacts([]);
      setHelperContacts([]);
      setAttendeeGroups([]);
      setHelperGroups([]);
    }
  }, [registrations, filterEvent, events, eventDates]);

  async function loadData() {
    try {
      const data = await loadAllData();

      setRegistrations(data.registrations);
      setContacts(data.contacts);
      setEvents(data.events);
      setEventDates(data.eventDates);

      if (data.eventDates.length > 0 && filterEvent === 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureDates = data.eventDates.filter(d => parseLocalDate(d.event_date) >= today);
        const datesToConsider = futureDates.length > 0 ? futureDates : data.eventDates;

        const sortedByLatest = [...datesToConsider].sort((a, b) => {
          return parseLocalDate(b.event_date).getTime() - parseLocalDate(a.event_date).getTime();
        });
        const latestDate = sortedByLatest[0];
        if (latestDate) {
          setFilterEvent(latestDate.event_id);
        }
      }

      const { faithStatuses, sourceGroups, positions } = extractFilterOptions(data.contacts, data.registrations);
      setFaithStatusOptions(faithStatuses);
      setSourceGroupOptions(sourceGroups);
      setPositionOptions(positions);
    } catch (error) {
      console.error('載入資料失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendanceToggle(contactId: string, eventDateId: string, registrationId?: string, currentAttendance?: Attendance | null, expectedRole?: 'attendee' | 'helper') {
    try {
      if (registrationId) {
        if (currentAttendance) {
          const { error } = await supabase
            .from('attendance')
            .update({ attended: !currentAttendance.attended })
            .eq('id', currentAttendance.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attendance')
            .insert([{
              registration_id: registrationId,
              attended: true
            }]);

          if (error) throw error;
        }
      } else {
        const eventDate = eventDates.find(d => d.id === eventDateId);
        if (!eventDate) throw new Error('找不到活動日期');

        const contactRegistrationsForThisEvent = registrations.filter(r => {
          const regEventDate = eventDates.find(d => d.id === r.event_date_id);
          return r.contact_id === contactId && regEventDate?.event_id === eventDate.event_id;
        });

        if (contactRegistrationsForThisEvent.length === 0) {
          throw new Error('此聯絡人尚未在此活動中登記');
        }

        const existingReg = contactRegistrationsForThisEvent[0];
        const roleToUse = existingReg.role;
        const positionToUse = existingReg.position;

        const { data: newReg, error: regError } = await supabase
          .from('registrations')
          .insert([{
            contact_id: contactId,
            event_date_id: eventDateId,
            registration_status: '已確認',
            registration_type: 'new',
            position: positionToUse,
            role: roleToUse
          }])
          .select()
          .single();

        if (regError) throw regError;

        const { error: attError } = await supabase
          .from('attendance')
          .insert([{
            registration_id: newReg.id,
            attended: true
          }]);

        if (attError) throw attError;
      }

      loadData();
    } catch (error) {
      console.error('更新出席狀態失敗:', error);
    }
  }

  async function handleQuickAdd() {
    if (!quickAddContact || !quickAddDate) return;

    try {
      const contact = contacts.find(c => c.id === quickAddContact);
      const { data: newReg, error: regError } = await supabase
        .from('registrations')
        .insert([{
          contact_id: quickAddContact,
          event_date_id: quickAddDate,
          registration_status: '已確認',
          registration_type: 'new',
          position: contact?.role === 'helper' ? '' : null,
          role: contact?.role || 'attendee'
        }])
        .select()
        .single();

      if (regError) throw regError;

      const { error: attError } = await supabase
        .from('attendance')
        .insert([{
          registration_id: newReg.id,
          attended: true
        }]);

      if (attError) throw attError;

      setShowQuickAdd(false);
      setQuickAddContact('');
      setQuickAddDate('');
      loadData();
    } catch (error) {
      console.error('快速新增失敗:', error);
    }
  }

  function startEditGroupName(contactId: string, currentGroupName: string) {
    setEditingGroupName(contactId);
    setTempGroupName(currentGroupName || '');
  }

  function cancelEditGroupName() {
    setEditingGroupName(null);
    setTempGroupName('');
  }

  async function saveGroupName(contactId: string) {
    try {
      if (filterEvent === 'all') {
        alert('請先選擇活動');
        return;
      }

      const selectedEvent = events.find(e => e.id === filterEvent);
      if (!selectedEvent) {
        alert('找不到選擇的活動');
        return;
      }

      const contact = contacts.find(c => c.id === contactId);
      if (!contact) {
        alert('找不到聯絡人');
        return;
      }

      const oldGroupName = contact.group_name || '未分組';
      const newGroupName = tempGroupName || '未分組';

      const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
      const eventDateIds = eventDatesForEvent.map(d => d.id);

      if (eventDateIds.length === 0) {
        alert('此活動沒有日期資料');
        return;
      }

      const currentRole = contact.role as 'attendee' | 'helper';
      const currentGroups = currentRole === 'attendee' ? attendeeGroups : helperGroups;

      const targetGroup = currentGroups.find(g => g.groupName === newGroupName);

      let newSequence: number;

      if (targetGroup && targetGroup.contacts.length > 0) {
        const targetGroupContactRegs = await Promise.all(
          targetGroup.contacts.map(async c => {
            const regs = registrations.filter(r =>
              r.contact_id === c.id &&
              eventDateIds.includes(r.event_date_id)
            );
            return Math.min(...regs.map(r => r.display_sequence ?? Infinity));
          })
        );
        const validSequences = targetGroupContactRegs.filter(s => s !== Infinity);
        const maxSequenceInGroup = validSequences.length > 0 ? Math.max(...validSequences) : -1;
        newSequence = maxSequenceInGroup + 1;
      } else {
        const allSequences = registrations
          .filter(r =>
            eventDateIds.includes(r.event_date_id) &&
            r.role === currentRole
          )
          .map(r => r.display_sequence ?? 0);

        newSequence = allSequences.length > 0 ? Math.max(...allSequences) + 1 : 0;
      }

      const { error: contactError } = await supabase
        .from('contacts')
        .update({ group_name: tempGroupName })
        .eq('id', contactId);

      if (contactError) throw contactError;

      const { error: seqError } = await supabase
        .from('registrations')
        .update({ display_sequence: newSequence })
        .eq('contact_id', contactId)
        .in('event_date_id', eventDateIds);

      if (seqError) throw seqError;

      setEditingGroupName(null);
      setTempGroupName('');
      loadData();
    } catch (error) {
      console.error('更新組別失敗:', error);
      alert(`更新組別失敗: ${error.message || '未知錯誤'}`);
    }
  }

  async function savePosition(contactId: string, eventId: string) {
    try {
      const selectedEvent = events.find(e => e.id === eventId);
      if (!selectedEvent) return;

      const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
      const eventDateIds = eventDatesForEvent.map(d => d.id);

      const { error } = await supabase
        .from('registrations')
        .update({ position: tempPosition })
        .eq('contact_id', contactId)
        .in('event_date_id', eventDateIds);

      if (error) throw error;

      setEditingPosition(null);
      setTempPosition('');
      loadData();
    } catch (error) {
      console.error('更新崗位失敗:', error);
      alert('更新崗位失敗');
    }
  }

  function startEditGroupHeader(groupName: string) {
    setEditingGroupHeader(groupName);
    setTempGroupHeader(groupName === '未分組' ? '' : groupName);
  }

  function cancelEditGroupHeader() {
    setEditingGroupHeader(null);
    setTempGroupHeader('');
  }

  async function saveGroupHeader(oldGroupName: string, role: 'attendee' | 'helper') {
    try {
      const newGroupName = tempGroupHeader || '未分組';

      if (filterEvent === 'all' || !selectedEvent) {
        alert('請先選擇活動');
        return;
      }

      const contactsToUpdate = role === 'attendee'
        ? attendeeGroups.find(g => g.groupName === oldGroupName)?.contacts || []
        : helperGroups.find(g => g.groupName === oldGroupName)?.contacts || [];

      const updatePromises = contactsToUpdate.map(contact =>
        supabase
          .from('contacts')
          .update({ group_name: tempGroupHeader })
          .eq('id', contact.id)
      );

      await Promise.all(updatePromises);

      setEditingGroupHeader(null);
      setTempGroupHeader('');
      loadData();
    } catch (error) {
      console.error('更新組別失敗:', error);
      alert('更新組別失敗');
    }
  }

  function toggleGroupCollapse(role: 'attendee' | 'helper', groupName: string) {
    if (role === 'attendee') {
      setAttendeeGroups(prev => prev.map(g =>
        g.groupName === groupName ? { ...g, isCollapsed: !g.isCollapsed } : g
      ));
    } else {
      setHelperGroups(prev => prev.map(g =>
        g.groupName === groupName ? { ...g, isCollapsed: !g.isCollapsed } : g
      ));
    }
  }

  function handleAttendeeGroupDragStart(index: number) {
    setDraggedAttendeeGroupIndex(index);
  }

  function handleAttendeeGroupDrop(dropIndex: number) {
    if (draggedAttendeeGroupIndex === null) return;

    const reordered = [...attendeeGroups];
    const [draggedItem] = reordered.splice(draggedAttendeeGroupIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setAttendeeGroups(reordered);
    setDraggedAttendeeGroupIndex(dropIndex);
  }

  function handleAttendeeGroupDragEnd() {
    setDraggedAttendeeGroupIndex(null);
  }

  function handleHelperGroupDragStart(index: number) {
    setDraggedHelperGroupIndex(index);
  }

  function handleHelperGroupDrop(dropIndex: number) {
    if (draggedHelperGroupIndex === null) return;

    const reordered = [...helperGroups];
    const [draggedItem] = reordered.splice(draggedHelperGroupIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setHelperGroups(reordered);
    setDraggedHelperGroupIndex(dropIndex);
  }

  function handleHelperGroupDragEnd() {
    setDraggedHelperGroupIndex(null);
  }

  function handleAttendeeDragStart(groupName: string, index: number) {
    setDraggedAttendeeIndex(index);
    setDraggedAttendeeGroupName(groupName);
  }

  async function handleAttendeeDrop(groupName: string, dropIndex: number) {
    if (draggedAttendeeIndex === null || draggedAttendeeGroupName === null) return;

    const isCrossGroupMove = draggedAttendeeGroupName !== groupName;
    const sourceGroupIndex = attendeeGroups.findIndex(g => g.groupName === draggedAttendeeGroupName);
    const destGroupIndex = attendeeGroups.findIndex(g => g.groupName === groupName);

    if (sourceGroupIndex === -1 || destGroupIndex === -1) return;

    const sourceGroup = attendeeGroups[sourceGroupIndex];
    const draggedContact = sourceGroup.contacts[draggedAttendeeIndex];

    if (!draggedContact) return;

    if (isCrossGroupMove) {
      try {
        if (filterEvent === 'all') {
          alert('請先選擇活動');
          return;
        }

        const selectedEvent = events.find(e => e.id === filterEvent);
        if (!selectedEvent) {
          alert('找不到選擇的活動');
          return;
        }

        const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
        const eventDateIds = eventDatesForEvent.map(d => d.id);

        if (eventDateIds.length === 0) {
          alert('此活動沒有日期資料');
          return;
        }

        const { error: contactError } = await supabase
          .from('contacts')
          .update({ group_name: groupName })
          .eq('id', draggedContact.id);

        if (contactError) throw contactError;

        const destGroup = attendeeGroups[destGroupIndex];
        const targetGroupContactRegs = await Promise.all(
          destGroup.contacts.map(async c => {
            const regs = registrations.filter(r =>
              r.contact_id === c.id &&
              eventDateIds.includes(r.event_date_id)
            );
            return Math.min(...regs.map(r => r.display_sequence ?? Infinity));
          })
        );

        const validSequences = targetGroupContactRegs.filter(s => s !== Infinity);
        const maxSequenceInGroup = validSequences.length > 0 ? Math.max(...validSequences) : -1;
        const newSequence = maxSequenceInGroup + 1;

        const { error: seqError } = await supabase
          .from('registrations')
          .update({ display_sequence: newSequence })
          .eq('contact_id', draggedContact.id)
          .in('event_date_id', eventDateIds);

        if (seqError) throw seqError;

        const updatedGroups = attendeeGroups.map((group, idx) => {
          if (idx === sourceGroupIndex) {
            return {
              ...group,
              contacts: group.contacts.filter(c => c.id !== draggedContact.id)
            };
          } else if (idx === destGroupIndex) {
            const newContacts = [...group.contacts];
            newContacts.splice(dropIndex, 0, draggedContact);
            return { ...group, contacts: newContacts };
          }
          return group;
        });

        setAttendeeGroups(updatedGroups);
        const flattenedContacts = updatedGroups.flatMap(g => g.contacts);
        setAttendeeContacts(flattenedContacts);
      } catch (error) {
        console.error('移動聯絡人失敗:', error);
        alert(`移動聯絡人失敗: ${error.message || '未知錯誤'}`);
      }
    } else {
      const updatedGroups = attendeeGroups.map(group => {
        if (group.groupName === draggedAttendeeGroupName) {
          const reordered = [...group.contacts];
          const [draggedItem] = reordered.splice(draggedAttendeeIndex, 1);
          reordered.splice(dropIndex, 0, draggedItem);
          return { ...group, contacts: reordered };
        }
        return group;
      });

      setAttendeeGroups(updatedGroups);
      const flattenedContacts = updatedGroups.flatMap(g => g.contacts);
      setAttendeeContacts(flattenedContacts);
      setDraggedAttendeeIndex(dropIndex);
    }
  }

  function handleAttendeeDragEnd() {
    setDraggedAttendeeIndex(null);
    setDraggedAttendeeGroupName(null);
  }

  function handleHelperDragStart(groupName: string, index: number) {
    setDraggedHelperIndex(index);
    setDraggedHelperGroupName(groupName);
  }

  async function handleHelperDrop(groupName: string, dropIndex: number) {
    if (draggedHelperIndex === null || draggedHelperGroupName === null) return;

    const isCrossGroupMove = draggedHelperGroupName !== groupName;
    const sourceGroupIndex = helperGroups.findIndex(g => g.groupName === draggedHelperGroupName);
    const destGroupIndex = helperGroups.findIndex(g => g.groupName === groupName);

    if (sourceGroupIndex === -1 || destGroupIndex === -1) return;

    const sourceGroup = helperGroups[sourceGroupIndex];
    const draggedContact = sourceGroup.contacts[draggedHelperIndex];

    if (!draggedContact) return;

    if (isCrossGroupMove) {
      try {
        if (filterEvent === 'all') {
          alert('請先選擇活動');
          return;
        }

        const selectedEvent = events.find(e => e.id === filterEvent);
        if (!selectedEvent) {
          alert('找不到選擇的活動');
          return;
        }

        const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
        const eventDateIds = eventDatesForEvent.map(d => d.id);

        if (eventDateIds.length === 0) {
          alert('此活動沒有日期資料');
          return;
        }

        const { error: contactError } = await supabase
          .from('contacts')
          .update({ group_name: groupName })
          .eq('id', draggedContact.id);

        if (contactError) throw contactError;

        const destGroup = helperGroups[destGroupIndex];
        const targetGroupContactRegs = await Promise.all(
          destGroup.contacts.map(async c => {
            const regs = registrations.filter(r =>
              r.contact_id === c.id &&
              eventDateIds.includes(r.event_date_id)
            );
            return Math.min(...regs.map(r => r.display_sequence ?? Infinity));
          })
        );

        const validSequences = targetGroupContactRegs.filter(s => s !== Infinity);
        const maxSequenceInGroup = validSequences.length > 0 ? Math.max(...validSequences) : -1;
        const newSequence = maxSequenceInGroup + 1;

        const { error: seqError } = await supabase
          .from('registrations')
          .update({ display_sequence: newSequence })
          .eq('contact_id', draggedContact.id)
          .in('event_date_id', eventDateIds);

        if (seqError) throw seqError;

        const updatedGroups = helperGroups.map((group, idx) => {
          if (idx === sourceGroupIndex) {
            return {
              ...group,
              contacts: group.contacts.filter(c => c.id !== draggedContact.id)
            };
          } else if (idx === destGroupIndex) {
            const newContacts = [...group.contacts];
            newContacts.splice(dropIndex, 0, draggedContact);
            return { ...group, contacts: newContacts };
          }
          return group;
        });

        setHelperGroups(updatedGroups);
        const flattenedContacts = updatedGroups.flatMap(g => g.contacts);
        setHelperContacts(flattenedContacts);
      } catch (error) {
        console.error('移動聯絡人失敗:', error);
        alert(`移動聯絡人失敗: ${error.message || '未知錯誤'}`);
      }
    } else {
      const updatedGroups = helperGroups.map(group => {
        if (group.groupName === draggedHelperGroupName) {
          const reordered = [...group.contacts];
          const [draggedItem] = reordered.splice(draggedHelperIndex, 1);
          reordered.splice(dropIndex, 0, draggedItem);
          return { ...group, contacts: reordered };
        }
        return group;
      });

      setHelperGroups(updatedGroups);
      const flattenedContacts = updatedGroups.flatMap(g => g.contacts);
      setHelperContacts(flattenedContacts);
      setDraggedHelperIndex(dropIndex);
    }
  }

  function handleHelperDragEnd() {
    setDraggedHelperIndex(null);
    setDraggedHelperGroupName(null);
  }

  async function saveAttendanceSequence() {
    if (filterEvent === 'all' || !selectedEvent) {
      alert('請先選擇活動');
      return;
    }

    try {
      const selectedEvent = events.find(e => e.id === filterEvent);
      if (!selectedEvent) return;

      const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
      const eventDateIds = eventDatesForEvent.map(d => d.id);

      const updatePromises: Promise<any>[] = [];

      // Save attendee group order and contact order within groups
      let attendeeSequence = 0;
      attendeeGroups.forEach(group => {
        group.contacts.forEach(contact => {
          const promise = supabase
            .from('registrations')
            .update({ display_sequence: attendeeSequence })
            .eq('contact_id', contact.id)
            .in('event_date_id', eventDateIds);
          updatePromises.push(promise);
          attendeeSequence++;
        });
      });

      // Save helper group order and contact order within groups
      let helperSequence = 1000; // Start from 1000 to separate from attendees
      helperGroups.forEach(group => {
        group.contacts.forEach(contact => {
          const promise = supabase
            .from('registrations')
            .update({ display_sequence: helperSequence })
            .eq('contact_id', contact.id)
            .in('event_date_id', eventDateIds);
          updatePromises.push(promise);
          helperSequence++;
        });
      });

      await Promise.all(updatePromises);
      alert('順序已儲存（包含組別順序）');
    } catch (error) {
      console.error('儲存順序失敗:', error);
      alert('儲存順序失敗');
    }
  }

  function groupAttendanceByContact(regs: RegistrationWithDetails[], eventId: string) {
    const grouped = new Map<string, GroupedAttendance>();

    regs.forEach(reg => {
      if (reg.event_date.event.id !== eventId) return;

      if (!grouped.has(reg.contact_id)) {
        grouped.set(reg.contact_id, {
          contact: reg.contact,
          dates: new Map(),
          displaySequence: reg.display_sequence || 0
        });
      }

      grouped.get(reg.contact_id)!.dates.set(reg.event_date_id, {
        registration: reg,
        attendance: reg.attendance
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.displaySequence - b.displaySequence);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  const selectedEvent = filterEvent !== 'all' ? events.find(e => e.id === filterEvent) : null;
  const allSelectedEventDates = selectedEvent
    ? eventDates.filter(d => d.event_id === selectedEvent.id).sort((a, b) =>
        parseLocalDate(a.event_date).getTime() - parseLocalDate(b.event_date).getTime()
      )
    : [];

  const filteredEventDates = selectedDateFilters.length > 0
    ? allSelectedEventDates.filter(d => selectedDateFilters.includes(d.id))
    : allSelectedEventDates;

  const totalPages = Math.ceil(filteredEventDates.length / datesPerPage);
  const selectedEventDatesData = selectedDateFilters.length > 0
    ? filteredEventDates
    : filteredEventDates.slice(
        eventDatePage * datesPerPage,
        (eventDatePage + 1) * datesPerPage
      );

  const attendeeAttendance = selectedEvent
    ? groupAttendanceByContact(
        registrations.filter(r => r.role === 'attendee'),
        selectedEvent.id
      )
    : [];

  const helperAttendance = selectedEvent
    ? groupAttendanceByContact(
        registrations.filter(r => r.role === 'helper'),
        selectedEvent.id
      )
    : [];

  const allAttendeeContacts = attendeeContacts
    .filter(c => {
      if (attendeeFilters.name && !c.name.toLowerCase().includes(attendeeFilters.name.toLowerCase())) return false;
      if (attendeeFilters.faithStatus && c.faith_status !== attendeeFilters.faithStatus) return false;
      if (attendeeFilters.sourceGroup && c.source_group !== attendeeFilters.sourceGroup) return false;
      if (attendeeFilters.groupName && !c.group_name.toLowerCase().includes(attendeeFilters.groupName.toLowerCase())) return false;
      return true;
    });

  const allHelperContacts = helperContacts
    .filter(c => {
      if (helperFilters.name && !c.name.toLowerCase().includes(helperFilters.name.toLowerCase())) return false;
      if (helperFilters.sourceGroup && c.source_group !== helperFilters.sourceGroup) return false;
      if (helperFilters.groupName && !c.group_name.toLowerCase().includes(helperFilters.groupName.toLowerCase())) return false;

      const group = helperAttendance.find(g => g.contact.id === c.id);
      const firstDateData = group ? Array.from(group.dates.values())[0] : null;

      if (helperFilters.position && firstDateData?.registration.position !== helperFilters.position) return false;

      return true;
    });

  const calculateStats = (group: GroupedAttendance[]) => {
    let totalRegistrations = 0;
    let totalAttended = 0;

    group.forEach(g => {
      g.dates.forEach((d, dateId) => {
        if (selectedDateFilters.length === 0 || selectedDateFilters.includes(dateId)) {
          totalRegistrations++;
          if (d.attendance?.attended) totalAttended++;
        }
      });
    });

    return { totalRegistrations, totalAttended };
  };

  const attendeeStats = calculateStats(attendeeAttendance);
  const helperStats = calculateStats(helperAttendance);
  const totalStats = {
    totalRegistrations: attendeeStats.totalRegistrations + helperStats.totalRegistrations,
    totalAttended: attendeeStats.totalAttended + helperStats.totalAttended
  };

  function handleExportAttendeeCSV() {
    const exportData: any[] = [];
    const dateColumns = selectedEventDatesData.map(date => parseLocalDate(date.event_date).toLocaleDateString('zh-TW'));

    attendeeGroups.forEach(group => {
      exportData.push({
        '姓名': `【${group.groupName}】`,
        '信仰狀況': '',
        '來源群組': '',
        ...Object.fromEntries(dateColumns.map(date => [date, '']))
      });

      group.contacts.forEach(contact => {
        const attendanceGroup = attendeeAttendance.find(g => g.contact.id === contact.id);
        const row: any = {
          '姓名': contact.name,
          '信仰狀況': contact.faith_status || '-',
          '來源群組': contact.source_group || '-'
        };

        selectedEventDatesData.forEach(date => {
          const dateData = attendanceGroup?.dates.get(date.id);
          row[parseLocalDate(date.event_date).toLocaleDateString('zh-TW')] = dateData?.attendance?.attended ? '✓' : '';
        });

        exportData.push(row);
      });
    });

    exportToCSV(exportData, `參加者出席_${selectedEvent?.name || '所有活動'}_${new Date().toLocaleDateString('zh-TW')}`);
  }

  function handleExportHelperCSV() {
    const exportData: any[] = [];
    const dateColumns = selectedEventDatesData.map(date => parseLocalDate(date.event_date).toLocaleDateString('zh-TW'));

    helperGroups.forEach(group => {
      exportData.push({
        '姓名': `【${group.groupName}】`,
        '來源群組': '',
        '崗位': '',
        ...Object.fromEntries(dateColumns.map(date => [date, '']))
      });

      group.contacts.forEach(contact => {
        const helperGroup = helperAttendance.find(g => g.contact.id === contact.id);
        const firstDateData = helperGroup ? Array.from(helperGroup.dates.values())[0] : null;
        const row: any = {
          '姓名': contact.name,
          '來源群組': contact.source_group || '-',
          '崗位': firstDateData?.registration.position || '-'
        };

        selectedEventDatesData.forEach(date => {
          const dateData = helperGroup?.dates.get(date.id);
          row[parseLocalDate(date.event_date).toLocaleDateString('zh-TW')] = dateData?.attendance?.attended ? '✓' : '';
        });

        exportData.push(row);
      });
    });

    exportToCSV(exportData, `協助人員出席_${selectedEvent?.name || '所有活動'}_${new Date().toLocaleDateString('zh-TW')}`);
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">出席記錄</h2>
        {selectedEvent && (
          <div className="flex gap-2">
            <button
              onClick={() => exportToPDF('attendance-table', `出席記錄_${selectedEvent?.name}`)}
              disabled={allAttendeeContacts.length === 0 && allHelperContacts.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <FileText className="w-5 h-5" />
              列印PDF
            </button>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              快速登記出席
            </button>
            <button
              onClick={saveAttendanceSequence}
              disabled={filterEvent === 'all'}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              儲存順序
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <Filter className="w-5 h-5 text-gray-500" />
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">請選擇活動...</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
        {selectedEvent && allSelectedEventDates.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-700">選擇日期：</span>
            {allSelectedEventDates.map(date => (
              <label key={date.id} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDateFilters.includes(date.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDateFilters([...selectedDateFilters, date.id]);
                    } else {
                      setSelectedDateFilters(selectedDateFilters.filter(id => id !== date.id));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm">
                  {parseLocalDate(date.event_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                </span>
              </label>
            ))}
            {selectedDateFilters.length > 0 && (
              <button
                onClick={() => setSelectedDateFilters([])}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                清除選擇
              </button>
            )}
          </div>
        )}
      </div>

      {selectedEvent && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 flex items-center gap-4 mb-3">
            <span>說明：</span>
            <span className="flex items-center gap-1">
              <input type="checkbox" className="w-4 h-4 text-green-600 border-gray-300 rounded pointer-events-none" checked readOnly />
              已登記
            </span>
            <span className="flex items-center gap-1">
              <input type="checkbox" className="w-4 h-4 appearance-none bg-gray-500 border-2 border-gray-600 rounded pointer-events-none" readOnly />
              未登記（可勾選記錄出席）
            </span>
          </div>
          {totalPages > 1 && selectedDateFilters.length === 0 && (
            <div className="flex items-center gap-3 justify-end">
              <span className="text-sm text-gray-600">
                顯示日期 {eventDatePage * datesPerPage + 1}-{Math.min((eventDatePage + 1) * datesPerPage, filteredEventDates.length)} / 共 {filteredEventDates.length} 個
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEventDatePage(Math.max(0, eventDatePage - 1))}
                  disabled={eventDatePage === 0}
                  className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一頁
                </button>
                <button
                  onClick={() => setEventDatePage(Math.min(totalPages - 1, eventDatePage + 1))}
                  disabled={eventDatePage >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEvent ? (
        <>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-1">參加者登記人次</h3>
              <p className="text-2xl font-bold text-blue-700">{attendeeStats.totalRegistrations}</p>
              <p className="text-xs text-blue-600 mt-1">協助人員: {helperStats.totalRegistrations}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-1">參加者已出席</h3>
              <p className="text-2xl font-bold text-green-700">{attendeeStats.totalAttended}</p>
              <p className="text-xs text-green-600 mt-1">協助人員: {helperStats.totalAttended}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-1">參加者出席率</h3>
              <p className="text-2xl font-bold text-gray-700">
                {attendeeStats.totalRegistrations > 0
                  ? Math.round((attendeeStats.totalAttended / attendeeStats.totalRegistrations) * 100)
                  : 0}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                協助人員: {helperStats.totalRegistrations > 0
                  ? Math.round((helperStats.totalAttended / helperStats.totalRegistrations) * 100)
                  : 0}%
              </p>
            </div>
          </div>

          <div id="attendance-table" className="space-y-8">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-blue-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">參加者出席</h3>
                <button
                  onClick={handleExportAttendeeCSV}
                  disabled={allAttendeeContacts.length === 0}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  匯出CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-10"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                        <div>姓名</div>
                        <input
                          type="text"
                          value={attendeeFilters.name}
                          onChange={(e) => setAttendeeFilters({ ...attendeeFilters, name: e.target.value })}
                          placeholder="篩選..."
                          className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      </th>
                      {showFaithStatus && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            <span>信仰狀況</span>
                            <button
                              onClick={() => setShowFaithStatus(false)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                              title="隱藏此欄"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <select
                            value={attendeeFilters.faithStatus}
                            onChange={(e) => setAttendeeFilters({ ...attendeeFilters, faithStatus: e.target.value })}
                            className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">全部</option>
                            {faithStatusOptions.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </th>
                      )}
                      {!showFaithStatus && (
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => setShowFaithStatus(true)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="顯示信仰狀況"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      )}
                      {showAttendeeSourceGroup && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            <span>來源群組</span>
                            <button
                              onClick={() => setShowAttendeeSourceGroup(false)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                              title="隱藏此欄"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <select
                            value={attendeeFilters.sourceGroup}
                            onChange={(e) => setAttendeeFilters({ ...attendeeFilters, sourceGroup: e.target.value })}
                            className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">全部</option>
                            {sourceGroupOptions.map(group => (
                              <option key={group} value={group}>{group}</option>
                            ))}
                          </select>
                        </th>
                      )}
                      {!showAttendeeSourceGroup && (
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => setShowAttendeeSourceGroup(true)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="顯示來源群組"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      )}
                      {showGroupName && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ maxWidth: '160px' }}>
                          <div className="flex items-center gap-1">
                            <span>組別</span>
                            <button
                              onClick={() => setShowGroupName(false)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                              title="隱藏此欄"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={attendeeFilters.groupName}
                            onChange={(e) => setAttendeeFilters({ ...attendeeFilters, groupName: e.target.value })}
                            placeholder="篩選..."
                            className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        </th>
                      )}
                      {!showGroupName && (
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => setShowGroupName(true)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="顯示組別"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      )}
                      {selectedEventDatesData.map(date => (
                        <th key={date.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <span className="text-sm">{parseLocalDate(date.event_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendeeGroups.length > 0 ? attendeeGroups.flatMap((groupData, groupIndex) => {
                      const filteredContacts = groupData.contacts.filter(c => {
                        if (attendeeFilters.name && !c.name.toLowerCase().includes(attendeeFilters.name.toLowerCase())) return false;
                        if (attendeeFilters.faithStatus && c.faith_status !== attendeeFilters.faithStatus) return false;
                        if (attendeeFilters.sourceGroup && c.source_group !== attendeeFilters.sourceGroup) return false;
                        if (attendeeFilters.groupName && !c.group_name?.toLowerCase().includes(attendeeFilters.groupName.toLowerCase())) return false;
                        return true;
                      });

                      if (filteredContacts.length === 0) return [];

                      const totalColumns = 2 + (showFaithStatus ? 1 : 0) + (showAttendeeSourceGroup ? 1 : 0) + (showGroupName ? 1 : 0) + selectedEventDatesData.length;

                      const groupHeaderRow = (
                        <tr
                          key={`group-${groupData.groupName}`}
                          className="bg-blue-100 border-t-2 border-blue-300 cursor-move"
                          draggable
                          onDragStart={() => handleAttendeeGroupDragStart(groupIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleAttendeeGroupDrop(groupIndex)}
                          onDragEnd={handleAttendeeGroupDragEnd}
                        >
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <GripVertical className="w-4 h-4 text-blue-600" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupCollapse('attendee', groupData.groupName);
                                }}
                                className="p-1 hover:bg-blue-200 rounded"
                              >
                                {groupData.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td colSpan={totalColumns - 1} className="px-6 py-2">
                            {editingGroupHeader === groupData.groupName ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={tempGroupHeader}
                                  onChange={(e) => setTempGroupHeader(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  placeholder="組別名稱"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveGroupHeader(groupData.groupName, 'attendee')}
                                  className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                >
                                  儲存
                                </button>
                                <button
                                  onClick={cancelEditGroupHeader}
                                  className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => startEditGroupHeader(groupData.groupName)}
                                className="font-semibold text-blue-900 cursor-pointer hover:bg-blue-200 px-2 py-1 rounded inline-block"
                                title="點擊編輯組別名稱"
                              >
                                {groupData.groupName} ({filteredContacts.length})
                              </span>
                            )}
                          </td>
                        </tr>
                      );

                      if (groupData.isCollapsed) {
                        return [groupHeaderRow];
                      }

                      const contactRows = filteredContacts.map((contact, index) => {
                        const group = attendeeAttendance.find(g => g.contact.id === contact.id);
                        return (
                          <tr
                            key={contact.id}
                            className="hover:bg-gray-50"
                            draggable
                            onDragStart={() => handleAttendeeDragStart(groupData.groupName, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleAttendeeDrop(groupData.groupName, index)}
                            onDragEnd={handleAttendeeDragEnd}
                          >
                            <td className="px-2 py-4 text-center cursor-move">
                              <GripVertical className="w-4 h-4 text-gray-400 inline-block" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-base font-semibold text-gray-900 sticky left-0 bg-white">
                              {contact.name}
                            </td>
                            {showFaithStatus && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {contact.faith_status || '-'}
                              </td>
                            )}
                            {!showFaithStatus && (
                              <td className="px-2 py-4"></td>
                            )}
                            {showAttendeeSourceGroup && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {contact.source_group || '-'}
                              </td>
                            )}
                            {!showAttendeeSourceGroup && (
                              <td className="px-2 py-4"></td>
                            )}
                            {showGroupName && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ maxWidth: '160px' }}>
                                {editingGroupName === contact.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={tempGroupName}
                                      onChange={(e) => setTempGroupName(e.target.value)}
                                      className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-32"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => saveGroupName(contact.id)}
                                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                    >
                                      儲存
                                    </button>
                                    <button
                                      onClick={cancelEditGroupName}
                                      className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    onClick={() => startEditGroupName(contact.id, contact.group_name)}
                                    className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block truncate"
                                    title={contact.group_name || '點擊編輯組別'}
                                  >
                                    {contact.group_name || '-'}
                                  </span>
                                )}
                              </td>
                            )}
                            {!showGroupName && (
                              <td className="px-2 py-4"></td>
                            )}
                            {selectedEventDatesData.map(date => {
                              const dateData = group?.dates.get(date.id);
                              const attended = dateData?.attendance?.attended || false;
                              const isRegistered = !!dateData;
                              return (
                                <td key={date.id} className="px-6 py-4 text-center">
                                  {isRegistered ? (
                                    <input
                                      type="checkbox"
                                      checked={attended}
                                      onChange={() => handleAttendanceToggle(
                                        contact.id,
                                        date.id,
                                        dateData?.registration.id,
                                        dateData?.attendance,
                                        'attendee'
                                      )}
                                      className="w-5 h-5 rounded cursor-pointer text-green-600 border-gray-300 focus:ring-green-500"
                                      title="已登記"
                                    />
                                  ) : (
                                    <div className="inline-flex items-center justify-center">
                                      <input
                                        type="checkbox"
                                        checked={attended}
                                        onChange={() => handleAttendanceToggle(
                                          contact.id,
                                          date.id,
                                          dateData?.registration.id,
                                          dateData?.attendance,
                                          'attendee'
                                        )}
                                        className="w-5 h-5 rounded cursor-pointer appearance-none bg-gray-500 border-2 border-gray-600 checked:bg-green-600 checked:border-green-600 focus:ring-2 focus:ring-gray-400"
                                        title="未登記（可勾選記錄出席）"
                                      />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });

                      return [groupHeaderRow, ...contactRows];
                    }) : (
                      <tr>
                        <td colSpan={3 + selectedEventDatesData.length} className="px-6 py-8 text-center text-gray-500">
                          暫無參加者
                        </td>
                      </tr>
                    )}
                    {allAttendeeContacts.length > 0 && (
                      <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                        <td className="px-2 py-3"></td>
                        <td className="px-6 py-3 text-sm text-gray-900 sticky left-0 bg-blue-50">
                          總計
                        </td>
                        {showFaithStatus && (
                          <td className="px-6 py-3 text-sm text-gray-700">
                            登記: {allAttendeeContacts.filter(c => {
                              const group = attendeeAttendance.find(g => g.contact.id === c.id);
                              return group && group.dates.size > 0;
                            }).length}
                          </td>
                        )}
                        {!showFaithStatus && (
                          <td className="px-2 py-3"></td>
                        )}
                        {showAttendeeSourceGroup && (
                          <td className="px-6 py-3"></td>
                        )}
                        {!showAttendeeSourceGroup && (
                          <td className="px-2 py-3"></td>
                        )}
                        {showGroupName && (
                          <td className="px-6 py-3"></td>
                        )}
                        {!showGroupName && (
                          <td className="px-2 py-3"></td>
                        )}
                        {selectedEventDatesData.map(date => {
                          const registeredCount = allAttendeeContacts.filter(contact => {
                            const group = attendeeAttendance.find(g => g.contact.id === contact.id);
                            return group?.dates.has(date.id);
                          }).length;
                          const attendedCount = allAttendeeContacts.filter(contact => {
                            const group = attendeeAttendance.find(g => g.contact.id === contact.id);
                            return group?.dates.get(date.id)?.attendance?.attended;
                          }).length;
                          return (
                            <td key={date.id} className="px-6 py-3 text-center text-blue-900">
                              <div className="font-bold">{attendedCount}/{registeredCount}</div>
                              <div className="text-xs text-gray-600">
                                {registeredCount > 0 ? Math.round((attendedCount / registeredCount) * 100) : 0}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-green-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">協助人員出席</h3>
                <button
                  onClick={handleExportHelperCSV}
                  disabled={allHelperContacts.length === 0}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  匯出CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-10"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                        <div>姓名</div>
                        <input
                          type="text"
                          value={helperFilters.name}
                          onChange={(e) => setHelperFilters({ ...helperFilters, name: e.target.value })}
                          placeholder="篩選..."
                          className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      </th>
                      {showHelperSourceGroup && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            <span>來源群組</span>
                            <button
                              onClick={() => setShowHelperSourceGroup(false)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                              title="隱藏此欄"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <select
                            value={helperFilters.sourceGroup}
                            onChange={(e) => setHelperFilters({ ...helperFilters, sourceGroup: e.target.value })}
                            className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">全部</option>
                            {sourceGroupOptions.map(group => (
                              <option key={group} value={group}>{group}</option>
                            ))}
                          </select>
                        </th>
                      )}
                      {!showHelperSourceGroup && (
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => setShowHelperSourceGroup(true)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="顯示來源群組"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ maxWidth: '140px' }}>
                        <div>崗位</div>
                        <select
                          value={helperFilters.position}
                          onChange={(e) => setHelperFilters({ ...helperFilters, position: e.target.value })}
                          className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                          <option value="">全部</option>
                          {positionOptions.map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </th>
                      {showGroupName && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ maxWidth: '160px' }}>
                          <div className="flex items-center gap-1">
                            <span>組別</span>
                            <button
                              onClick={() => setShowGroupName(false)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                              title="隱藏此欄"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={helperFilters.groupName}
                            onChange={(e) => setHelperFilters({ ...helperFilters, groupName: e.target.value })}
                            placeholder="篩選..."
                            className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        </th>
                      )}
                      {!showGroupName && (
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => setShowGroupName(true)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="顯示組別"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      )}
                      {selectedEventDatesData.map(date => (
                        <th key={date.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <span className="text-sm">{parseLocalDate(date.event_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {helperGroups.length > 0 ? helperGroups.flatMap((groupData, groupIndex) => {
                      const filteredContacts = groupData.contacts.filter(c => {
                        if (helperFilters.name && !c.name.toLowerCase().includes(helperFilters.name.toLowerCase())) return false;
                        if (helperFilters.sourceGroup && c.source_group !== helperFilters.sourceGroup) return false;
                        if (helperFilters.groupName && !c.group_name?.toLowerCase().includes(helperFilters.groupName.toLowerCase())) return false;

                        const group = helperAttendance.find(g => g.contact.id === c.id);
                        const firstDateData = group ? Array.from(group.dates.values())[0] : null;

                        if (helperFilters.position && firstDateData?.registration.position !== helperFilters.position) return false;

                        return true;
                      });

                      if (filteredContacts.length === 0) return [];

                      const totalColumns = 2 + (showHelperSourceGroup ? 1 : 0) + (showGroupName ? 1 : 0) + 1 + selectedEventDatesData.length;

                      const groupHeaderRow = (
                        <tr
                          key={`group-${groupData.groupName}`}
                          className="bg-green-100 border-t-2 border-green-300 cursor-move"
                          draggable
                          onDragStart={() => handleHelperGroupDragStart(groupIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleHelperGroupDrop(groupIndex)}
                          onDragEnd={handleHelperGroupDragEnd}
                        >
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <GripVertical className="w-4 h-4 text-green-600" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupCollapse('helper', groupData.groupName);
                                }}
                                className="p-1 hover:bg-green-200 rounded"
                              >
                                {groupData.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td colSpan={totalColumns - 1} className="px-6 py-2">
                            {editingGroupHeader === groupData.groupName ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={tempGroupHeader}
                                  onChange={(e) => setTempGroupHeader(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                  placeholder="組別名稱"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveGroupHeader(groupData.groupName, 'helper')}
                                  className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                >
                                  儲存
                                </button>
                                <button
                                  onClick={cancelEditGroupHeader}
                                  className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => startEditGroupHeader(groupData.groupName)}
                                className="font-semibold text-green-900 cursor-pointer hover:bg-green-200 px-2 py-1 rounded inline-block"
                                title="點擊編輯組別名稱"
                              >
                                {groupData.groupName} ({filteredContacts.length})
                              </span>
                            )}
                          </td>
                        </tr>
                      );

                      if (groupData.isCollapsed) {
                        return [groupHeaderRow];
                      }

                      const contactRows = filteredContacts.map((contact, index) => {
                        const group = helperAttendance.find(g => g.contact.id === contact.id);
                        const firstDateData = group ? Array.from(group.dates.values())[0] : null;
                        return (
                          <tr
                            key={contact.id}
                            className="hover:bg-gray-50"
                            draggable
                            onDragStart={() => handleHelperDragStart(groupData.groupName, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleHelperDrop(groupData.groupName, index)}
                            onDragEnd={handleHelperDragEnd}
                          >
                            <td className="px-2 py-4 text-center cursor-move">
                              <GripVertical className="w-4 h-4 text-gray-400 inline-block" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-base font-semibold text-gray-900 sticky left-0 bg-white">
                              {contact.name}
                            </td>
                            {showHelperSourceGroup && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {contact.source_group || '-'}
                              </td>
                            )}
                            {!showHelperSourceGroup && (
                              <td className="px-2 py-4"></td>
                            )}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600" style={{ maxWidth: '140px' }}>
                              {editingPosition === contact.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={tempPosition}
                                    onChange={(e) => setTempPosition(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-24"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => savePosition(contact.id, filterEvent)}
                                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                  >
                                    儲存
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPosition(null);
                                      setTempPosition('');
                                    }}
                                    className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingPosition(contact.id);
                                    setTempPosition(firstDateData?.registration.position || '');
                                  }}
                                  className="cursor-pointer hover:text-blue-600 hover:underline block truncate"
                                  title={firstDateData?.registration.position || '-'}
                                >
                                  {firstDateData?.registration.position || '-'}
                                </span>
                              )}
                            </td>
                            {showGroupName && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ maxWidth: '160px' }}>
                                {editingGroupName === contact.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={tempGroupName}
                                      onChange={(e) => setTempGroupName(e.target.value)}
                                      className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-32"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => saveGroupName(contact.id)}
                                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                    >
                                      儲存
                                    </button>
                                    <button
                                      onClick={cancelEditGroupName}
                                      className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    onClick={() => startEditGroupName(contact.id, contact.group_name)}
                                    className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block truncate"
                                    title={contact.group_name || '點擊編輯組別'}
                                  >
                                    {contact.group_name || '-'}
                                  </span>
                                )}
                              </td>
                            )}
                            {!showGroupName && (
                              <td className="px-2 py-4"></td>
                            )}
                            {selectedEventDatesData.map(date => {
                              const dateData = group?.dates.get(date.id);
                              const attended = dateData?.attendance?.attended || false;
                              const isRegistered = !!dateData;
                              return (
                                <td key={date.id} className="px-6 py-4 text-center">
                                  {isRegistered ? (
                                    <input
                                      type="checkbox"
                                      checked={attended}
                                      onChange={() => handleAttendanceToggle(
                                        contact.id,
                                        date.id,
                                        dateData?.registration.id,
                                        dateData?.attendance,
                                        'helper'
                                      )}
                                      className="w-5 h-5 rounded cursor-pointer text-green-600 border-gray-300 focus:ring-green-500"
                                      title="已登記"
                                    />
                                  ) : (
                                    <div className="inline-flex items-center justify-center">
                                      <input
                                        type="checkbox"
                                        checked={attended}
                                        onChange={() => handleAttendanceToggle(
                                          contact.id,
                                          date.id,
                                          dateData?.registration.id,
                                          dateData?.attendance,
                                          'helper'
                                        )}
                                        className="w-5 h-5 rounded cursor-pointer appearance-none bg-gray-500 border-2 border-gray-600 checked:bg-green-600 checked:border-green-600 focus:ring-2 focus:ring-gray-400"
                                        title="未登記（可勾選記錄出席）"
                                      />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });

                      return [groupHeaderRow, ...contactRows];
                    }) : (
                      <tr>
                        <td colSpan={3 + selectedEventDatesData.length} className="px-6 py-8 text-center text-gray-500">
                          暫無協助人員
                        </td>
                      </tr>
                    )}
                    {allHelperContacts.length > 0 && (
                      <tr className="bg-green-50 border-t-2 border-green-200 font-semibold">
                        <td className="px-2 py-3"></td>
                        <td className="px-6 py-3 text-sm text-gray-900 sticky left-0 bg-green-50">
                          總計
                        </td>
                        {showHelperSourceGroup && (
                          <td className="px-6 py-3 text-sm text-gray-700">
                            登記: {allHelperContacts.filter(c => {
                              const group = helperAttendance.find(g => g.contact.id === c.id);
                              return group && group.dates.size > 0;
                            }).length}
                          </td>
                        )}
                        {!showHelperSourceGroup && (
                          <td className="px-2 py-3"></td>
                        )}
                        <td className="px-3 py-3"></td>
                        {showGroupName && (
                          <td className="px-6 py-3"></td>
                        )}
                        {!showGroupName && (
                          <td className="px-2 py-3"></td>
                        )}
                        {selectedEventDatesData.map(date => {
                          const registeredCount = allHelperContacts.filter(contact => {
                            const group = helperAttendance.find(g => g.contact.id === contact.id);
                            return group?.dates.has(date.id);
                          }).length;
                          const attendedCount = allHelperContacts.filter(contact => {
                            const group = helperAttendance.find(g => g.contact.id === contact.id);
                            return group?.dates.get(date.id)?.attendance?.attended;
                          }).length;
                          return (
                            <td key={date.id} className="px-6 py-3 text-center text-green-900">
                              <div className="font-bold">{attendedCount}/{registeredCount}</div>
                              <div className="text-xs text-gray-600">
                                {registeredCount > 0 ? Math.round((attendedCount / registeredCount) * 100) : 0}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">請選擇活動以查看出席資料</p>
        </div>
      )}

      {showQuickAdd && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowQuickAdd(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">快速登記出席</h3>
            <p className="text-sm text-gray-600 mb-4">為未預先登記的參加者快速登記並標記出席</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  選擇聯絡人 <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickAddContact}
                  onChange={(e) => setQuickAddContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">請選擇...</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} - {contact.role === 'helper' ? '協助人員' : '參加者'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  選擇日期 <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickAddDate}
                  onChange={(e) => setQuickAddDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">請選擇...</option>
                  {selectedEventDatesData.map(date => (
                    <option key={date.id} value={date.id}>
                      {parseLocalDate(date.event_date).toLocaleDateString('zh-TW')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleQuickAdd}
                disabled={!quickAddContact || !quickAddDate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                確認登記
              </button>
              <button
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickAddContact('');
                  setQuickAddDate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
