import { useState, useEffect } from 'react';
import { Plus, Save, X, Filter, Trash2, Edit2, Download, FileText, GripVertical, ArrowUpDown } from 'lucide-react';
import { supabase, Contact, Event, EventDate, Registration } from '../lib/supabase';
import { loadAllData, extractFilterOptions } from '../lib/dataService';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';

type EditableRow = {
  id?: string;
  name: string;
  role: 'attendee' | 'helper';
  faithStatus: string;
  sourceGroup: string;
  groupName: string;
  position: string;
  isNew: boolean;
  isEditing: boolean;
  contactId?: string;
  registrations: Map<string, { regId: string; position: string }>;
  registrationSequence: number;
};

export function RegistrationManagement() {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [faithStatusOptions, setFaithStatusOptions] = useState<string[]>([]);
  const [sourceGroupOptions, setSourceGroupOptions] = useState<string[]>([]);
  const [groupNameOptions, setGroupNameOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    role: '',
    faithStatus: '',
    sourceGroup: '',
    groupName: '',
    position: ''
  });
  const [nameSortOrder, setNameSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedDateFilters, setSelectedDateFilters] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (contacts.length > 0) {
      buildRows();
    }
  }, [contacts, registrations, filterEvent, filterRole, nameSortOrder]);

  async function loadData() {
    try {
      const data = await loadAllData();

      setContacts(data.contacts);
      setEvents(data.events);
      setEventDates(data.eventDates);
      setRegistrations(data.registrations.map(r => ({
        id: r.id,
        contact_id: r.contact_id,
        event_date_id: r.event_date_id,
        registration_status: r.registration_status,
        registration_type: r.registration_type,
        position: r.position,
        role: r.role,
        display_sequence: r.display_sequence,
        registration_sequence: r.registration_sequence,
        created_at: r.created_at,
        updated_at: r.updated_at
      })));

      if (data.eventDates.length > 0 && filterEvent === 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureDates = data.eventDates.filter(d => new Date(d.event_date) >= today);
        const datesToConsider = futureDates.length > 0 ? futureDates : data.eventDates;

        const sortedByLatest = [...datesToConsider].sort((a, b) => {
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        });
        const latestDate = sortedByLatest[0];
        if (latestDate) {
          setFilterEvent(latestDate.event_id);
        }
      }

      const { faithStatuses, sourceGroups, groupNames, positions } = extractFilterOptions(data.contacts, data.registrations.map(r => ({
        id: r.id,
        contact_id: r.contact_id,
        event_date_id: r.event_date_id,
        registration_status: r.registration_status,
        registration_type: r.registration_type,
        position: r.position,
        role: r.role,
        display_sequence: r.display_sequence,
        registration_sequence: r.registration_sequence,
        created_at: r.created_at,
        updated_at: r.updated_at
      })));
      setFaithStatusOptions(faithStatuses);
      setSourceGroupOptions(sourceGroups);
      setGroupNameOptions(groupNames);
      setPositionOptions(positions);
    } catch (error) {
      console.error('載入資料失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildRows() {
    const selectedEvent = filterEvent !== 'all' ? events.find(e => e.id === filterEvent) : null;
    const filteredDates = selectedEvent
      ? eventDates.filter(d => d.event_id === selectedEvent.id)
      : [];

    if (!selectedEvent) {
      setRows([]);
      return;
    }

    const newRows: EditableRow[] = [];

    for (const contact of contacts) {
      const contactRegs = registrations.filter(r => r.contact_id === contact.id);
      const regMap = new Map<string, { regId: string; position: string }>();

      let firstReg: Registration | undefined;
      let hasRegForSelectedEvent = false;
      let registrationSequence = 0;

      filteredDates.forEach(date => {
        const reg = contactRegs.find(r => r.event_date_id === date.id);
        if (reg) {
          hasRegForSelectedEvent = true;
          if (!firstReg) {
            firstReg = reg;
            registrationSequence = reg.registration_sequence || 0;
          }
          regMap.set(date.id, {
            regId: reg.id,
            position: reg.position || ''
          });
        }
      });

      if (hasRegForSelectedEvent && firstReg) {
        if (filterRole !== 'all' && firstReg.role !== filterRole) {
          continue;
        }

        newRows.push({
          id: contact.id,
          name: contact.name,
          role: firstReg.role as 'attendee' | 'helper',
          faithStatus: contact.faith_status,
          sourceGroup: contact.source_group,
          groupName: contact.group_name,
          position: firstReg?.position || '',
          isNew: false,
          isEditing: false,
          contactId: contact.id,
          registrations: regMap,
          registrationSequence
        });
      }
    }

    newRows.sort((a, b) => {
      if (a.role === 'attendee' && b.role === 'helper') return -1;
      if (a.role === 'helper' && b.role === 'attendee') return 1;

      if (a.role === b.role) {
        if (nameSortOrder) {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          if (nameSortOrder === 'asc') {
            return nameA.localeCompare(nameB);
          } else {
            return nameB.localeCompare(nameA);
          }
        } else {
          return a.registrationSequence - b.registrationSequence;
        }
      }

      return 0;
    });

    setRows(newRows);
  }

  function findRowIndexByContactId(contactId: string): number {
    return rows.findIndex(row => row.contactId === contactId);
  }

  function addNewRow() {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newRow: EditableRow = {
      name: '',
      role: 'attendee',
      faithStatus: '',
      sourceGroup: '',
      groupName: '',
      position: '',
      isNew: true,
      isEditing: true,
      contactId: tempId,
      registrations: new Map(),
      registrationSequence: 0
    };
    setRows([newRow, ...rows]);
  }

  function updateRow(contactId: string, field: keyof EditableRow, value: any) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  }

  function startEdit(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const updated = [...rows];
    updated[index] = { ...updated[index], isEditing: true };
    setRows(updated);
  }

  function cancelEdit(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    if (rows[index].isNew) {
      setRows(rows.filter((_, i) => i !== index));
    } else {
      const updated = [...rows];
      updated[index] = { ...updated[index], isEditing: false };
      setRows(updated);
      buildRows();
    }
  }

  async function saveRow(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const row = rows[index];
    if (!row.name.trim()) {
      alert('請輸入姓名');
      return;
    }

    if (filterEvent === 'all') {
      alert('請先選擇活動');
      return;
    }

    try {
      let contactId = row.contactId;

      if (row.isNew && contactId?.startsWith('temp-')) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert([{
            name: row.name,
            role: row.role,
            faith_status: row.faithStatus,
            source_group: row.sourceGroup,
            group_name: row.groupName,
            notes: '',
            is_believer: false
          }])
          .select()
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;

        // Create registrations for checked dates
        if (row.registrations.size > 0) {
          const registrationsToInsert = Array.from(row.registrations.keys()).map(eventDateId => ({
            contact_id: contactId,
            event_date_id: eventDateId,
            registration_status: '已確認',
            registration_type: 'new',
            position: row.position || '',
            role: row.role
          }));

          const { error: regInsertError } = await supabase
            .from('registrations')
            .insert(registrationsToInsert);

          if (regInsertError) throw regInsertError;
        }
      } else if (row.isNew && contactId) {
        // User selected an existing contact, create registrations for it
        if (row.registrations.size > 0) {
          const registrationsToInsert = Array.from(row.registrations.keys()).map(eventDateId => ({
            contact_id: contactId,
            event_date_id: eventDateId,
            registration_status: '已確認',
            registration_type: 'new',
            position: row.position || '',
            role: row.role
          }));

          const { error: regInsertError } = await supabase
            .from('registrations')
            .insert(registrationsToInsert);

          if (regInsertError) throw regInsertError;
        }
      } else if (contactId) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            name: row.name,
            faith_status: row.faithStatus,
            source_group: row.sourceGroup,
            group_name: row.groupName
          })
          .eq('id', contactId);

        if (updateError) throw updateError;

        const selectedEvent = events.find(e => e.id === filterEvent);
        if (selectedEvent) {
          const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
          const eventDateIds = eventDatesForEvent.map(d => d.id);

          const { error: regUpdateError } = await supabase
            .from('registrations')
            .update({
              role: row.role,
              position: row.position || ''
            })
            .eq('contact_id', contactId)
            .in('event_date_id', eventDateIds);

          if (regUpdateError) throw regUpdateError;
        }
      }

      await loadData();
    } catch (error) {
      console.error('儲存失敗:', error);
      alert('儲存失敗，請重試');
    }
  }

  async function deleteRow(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const row = rows[index];
    if (!row.contactId) return;

    if (!confirm(`確定要刪除 ${row.name} 嗎？這將同時刪除所有相關登記記錄。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', row.contactId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗，請重試');
    }
  }

  async function toggleRegistration(contactId: string, eventDateId: string, regData?: { regId: string; position: string }) {
    try {
      if (regData) {
        const row = rows.find(r => r.contactId === contactId);
        if (!confirm(`確定要取消 ${row?.name || ''} 在此日期的登記嗎？`)) {
          return;
        }

        const { error } = await supabase
          .from('registrations')
          .delete()
          .eq('id', regData.regId);

        if (error) throw error;
      } else {
        const row = rows.find(r => r.contactId === contactId);

        const { error } = await supabase
          .from('registrations')
          .insert([{
            contact_id: contactId,
            event_date_id: eventDateId,
            registration_status: '已確認',
            registration_type: 'new',
            position: row?.position || '',
            role: row?.role || 'attendee'
          }]);

        if (error) throw error;
      }

      await loadData();
    } catch (error) {
      console.error('更新登記失敗:', error);
    }
  }

  async function saveCurrentSequence() {
    if (filterEvent === 'all' || !selectedEvent) {
      alert('請先選擇活動');
      return;
    }

    try {
      const selectedEvent = events.find(e => e.id === filterEvent);
      if (!selectedEvent) return;

      const eventDatesForEvent = eventDates.filter(d => d.event_id === selectedEvent.id);
      const eventDateIds = eventDatesForEvent.map(d => d.id);

      const attendeeRows = rows.filter(r => r.role === 'attendee');
      const helperRows = rows.filter(r => r.role === 'helper');

      const updatePromises: Promise<any>[] = [];

      attendeeRows.forEach((row, index) => {
        if (row.contactId) {
          const promise = supabase
            .from('registrations')
            .update({ registration_sequence: index })
            .eq('contact_id', row.contactId)
            .in('event_date_id', eventDateIds);
          updatePromises.push(promise);
        }
      });

      helperRows.forEach((row, index) => {
        if (row.contactId) {
          const promise = supabase
            .from('registrations')
            .update({ registration_sequence: index + 1000 })
            .eq('contact_id', row.contactId)
            .in('event_date_id', eventDateIds);
          updatePromises.push(promise);
        }
      });

      await Promise.all(updatePromises);
      alert('順序已儲存');
    } catch (error) {
      console.error('儲存順序失敗:', error);
      alert('儲存順序失敗');
    }
  }

  function toggleNameSort() {
    if (nameSortOrder === null) {
      setNameSortOrder('asc');
    } else if (nameSortOrder === 'asc') {
      setNameSortOrder('desc');
    } else {
      setNameSortOrder(null);
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const draggedRow = filteredRows[draggedIndex];
    const targetRow = filteredRows[index];

    if (draggedRow.role !== targetRow.role) return;

    const newRows = [...filteredRows];
    const [removed] = newRows.splice(draggedIndex, 1);
    newRows.splice(index, 0, removed);

    const attendeeRows = newRows.filter(r => r.role === 'attendee');
    const helperRows = newRows.filter(r => r.role === 'helper');
    const reorderedRows = [...attendeeRows, ...helperRows];

    setRows(reorderedRows);
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  const selectedEvent = filterEvent !== 'all' ? events.find(e => e.id === filterEvent) : null;
  const allSelectedEventDates = selectedEvent
    ? eventDates.filter(d => d.event_id === selectedEvent.id).sort((a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      )
    : [];

  const selectedEventDatesData = selectedDateFilters.length > 0
    ? allSelectedEventDates.filter(d => selectedDateFilters.includes(d.id))
    : allSelectedEventDates;

  const filteredRows = rows.filter(row => {
    if (columnFilters.name && !row.name.toLowerCase().includes(columnFilters.name.toLowerCase())) return false;
    if (columnFilters.role && row.role !== columnFilters.role) return false;
    if (columnFilters.faithStatus && row.faithStatus !== columnFilters.faithStatus) return false;
    if (columnFilters.sourceGroup && row.sourceGroup !== columnFilters.sourceGroup) return false;
    if (columnFilters.groupName && !row.groupName.toLowerCase().includes(columnFilters.groupName.toLowerCase())) return false;
    if (columnFilters.position && row.position !== columnFilters.position) return false;
    return true;
  });

  const calculateStats = () => {
    let totalRegistrations = 0;
    let attendeeCount = 0;
    let helperCount = 0;

    const datesToCount = selectedDateFilters.length > 0 ? selectedDateFilters : allSelectedEventDates.map(d => d.id);

    filteredRows.forEach(row => {
      datesToCount.forEach(dateId => {
        if (row.registrations.has(dateId)) {
          totalRegistrations++;
          if (row.role === 'attendee') {
            attendeeCount++;
          } else if (row.role === 'helper') {
            helperCount++;
          }
        }
      });
    });

    return { totalRegistrations, attendeeCount, helperCount };
  };

  const stats = calculateStats();

  function handleExportCSV() {
    const exportData = filteredRows.map(row => ({
      '姓名': row.name,
      '角色': row.role === 'helper' ? '協助人員' : '參加者',
      '信仰狀況': row.faithStatus || '-',
      '來源群組': row.sourceGroup || '-',
      '組別': row.groupName || '-',
      '崗位': row.position || '-',
      ...Object.fromEntries(
        selectedEventDatesData.map(date => [
          new Date(date.event_date).toLocaleDateString('zh-TW'),
          row.registrations.has(date.id) ? '✓' : ''
        ])
      )
    }));
    exportToCSV(exportData, `報名管理_${selectedEvent?.name || '所有活動'}_${new Date().toLocaleDateString('zh-TW')}`);
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">報名管理</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            匯出CSV
          </button>
          <button
            onClick={() => exportToPDF('registration-table', `報名管理_${selectedEvent?.name || '所有活動'}`)}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            列印PDF
          </button>
          <button
            onClick={addNewRow}
            disabled={filterEvent === 'all'}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            新增登記
          </button>
          <button
            onClick={saveCurrentSequence}
            disabled={filterEvent === 'all'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            儲存順序
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filterEvent}
            onChange={(e) => {
              setFilterEvent(e.target.value);
              setSelectedDateFilters([]);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">選擇活動...</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有人員</option>
          <option value="attendee">參加者</option>
          <option value="helper">協助人員</option>
        </select>
        {selectedEvent && allSelectedEventDates.length > 0 && (
          <>
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
                  {new Date(date.event_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
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
          </>
        )}
      </div>

      {selectedEvent ? (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-1">參加者登記人次</h3>
            <p className="text-2xl font-bold text-blue-700">{stats.attendeeCount}</p>
            <p className="text-xs text-blue-600 mt-1">協助人員: {stats.helperCount}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">登記總數</h3>
            <p className="text-2xl font-bold text-gray-700">{stats.totalRegistrations}</p>
            <p className="text-xs text-gray-600 mt-1">
              {selectedDateFilters.length > 0
                ? `已選擇 ${selectedDateFilters.length} 個日期`
                : `全部 ${allSelectedEventDates.length} 個日期`}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-xs text-gray-500">
          請先選擇活動以查看統計資料
        </div>
      )}

      <div id="registration-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-10"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  <div className="flex items-center gap-1">
                    <span>姓名</span>
                    <button
                      onClick={toggleNameSort}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={nameSortOrder === null ? '點擊排序' : nameSortOrder === 'asc' ? '升冪排序' : '降冪排序'}
                    >
                      <ArrowUpDown className={`w-3 h-3 ${nameSortOrder ? 'text-blue-600' : 'text-gray-400'}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={columnFilters.name}
                    onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                    placeholder="篩選..."
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>角色</div>
                  <select
                    value={columnFilters.role}
                    onChange={(e) => setColumnFilters({ ...columnFilters, role: e.target.value })}
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="">全部</option>
                    <option value="attendee">參加者</option>
                    <option value="helper">協助人員</option>
                  </select>
                </th>
                {filterRole !== 'helper' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>信仰狀況</div>
                    <select
                      value={columnFilters.faithStatus}
                      onChange={(e) => setColumnFilters({ ...columnFilters, faithStatus: e.target.value })}
                      className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">全部</option>
                      {faithStatusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>來源群組</div>
                  <select
                    value={columnFilters.sourceGroup}
                    onChange={(e) => setColumnFilters({ ...columnFilters, sourceGroup: e.target.value })}
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="">全部</option>
                    {sourceGroupOptions.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  <div>組別</div>
                  <input
                    type="text"
                    value={columnFilters.groupName}
                    onChange={(e) => setColumnFilters({ ...columnFilters, groupName: e.target.value })}
                    placeholder="篩選..."
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </th>
                {filterRole === 'helper' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>崗位</div>
                    <select
                      value={columnFilters.position}
                      onChange={(e) => setColumnFilters({ ...columnFilters, position: e.target.value })}
                      className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">全部</option>
                      {positionOptions.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </th>
                )}
                {selectedEventDatesData.map(date => (
                  <th key={date.id} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[64px]">
                    <span className="text-sm">{new Date(date.event_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.length > 0 ? filteredRows.map((row) => (
                <tr
                  key={row.id || `new-${row.contactId}`}
                  className={`hover:bg-gray-50 ${row.isNew ? 'bg-green-50' : ''}`}
                  draggable={!row.isEditing && !row.isNew}
                  onDragStart={() => handleDragStart(filteredRows.indexOf(row))}
                  onDragOver={(e) => handleDragOver(e, filteredRows.indexOf(row))}
                  onDragEnd={handleDragEnd}
                >
                  <td className="px-2 py-3 text-center cursor-move">
                    {!row.isEditing && !row.isNew && (
                      <GripVertical className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10">
                    {row.isEditing ? (
                      <>
                        <input
                          type="text"
                          list={row.isNew ? `contact-list-${row.contactId}` : undefined}
                          value={row.name}
                          onChange={(e) => {
                            const inputName = e.target.value;
                            updateRow(row.contactId || '', 'name', inputName);

                            const matchedContact = contacts.find(c => c.name === inputName);
                            if (matchedContact && row.isNew) {
                              const currentIndex = findRowIndexByContactId(row.contactId || '');
                              if (currentIndex !== -1) {
                                const updated = [...rows];
                                updated[currentIndex] = {
                                  ...updated[currentIndex],
                                  name: matchedContact.name,
                                  role: matchedContact.role as 'attendee' | 'helper',
                                  faithStatus: matchedContact.faith_status,
                                  sourceGroup: matchedContact.source_group,
                                  groupName: matchedContact.group_name,
                                  contactId: matchedContact.id
                                };
                                setRows(updated);
                              }
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="輸入或選擇姓名"
                        />
                        {row.isNew && (
                          <datalist id={`contact-list-${row.contactId}`}>
                            {contacts
                              .filter(c => !rows.some(r => r.contactId === c.id && r.contactId !== row.contactId))
                              .map(c => (
                                <option key={c.id} value={c.name}>
                                  {c.role === 'attendee' ? '參加者' : '協助人員'}
                                </option>
                              ))
                            }
                          </datalist>
                        )}
                      </>
                    ) : (
                      <span className="text-base font-semibold text-gray-900">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <select
                        value={row.role}
                        onChange={(e) => updateRow(row.contactId || '', 'role', e.target.value as 'attendee' | 'helper')}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="attendee">參加者</option>
                        <option value="helper">協助人員</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        row.role === 'helper' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {row.role === 'helper' ? '協助人員' : '參加者'}
                      </span>
                    )}
                  </td>
                  {filterRole !== 'helper' && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.isEditing ? (
                        <>
                          <input
                            type="text"
                            list={`faith-status-list-${row.contactId}`}
                            value={row.faithStatus}
                            onChange={(e) => updateRow(row.contactId || '', 'faithStatus', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="信仰狀況"
                          />
                          <datalist id={`faith-status-list-${row.contactId}`}>
                            {faithStatusOptions.map(status => (
                              <option key={status} value={status} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <span className="text-sm text-gray-600">{row.faithStatus || '-'}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <>
                        <input
                          type="text"
                          list={`source-group-list-${row.contactId}`}
                          value={row.sourceGroup}
                          onChange={(e) => updateRow(row.contactId || '', 'sourceGroup', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="來源群組"
                        />
                        <datalist id={`source-group-list-${row.contactId}`}>
                          {sourceGroupOptions.map(group => (
                            <option key={group} value={group} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">{row.sourceGroup || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap min-w-[150px]">
                    {row.isEditing ? (
                      <>
                        <input
                          type="text"
                          list={`group-name-list-${row.contactId}`}
                          value={row.groupName}
                          onChange={(e) => updateRow(row.contactId || '', 'groupName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="組別"
                        />
                        <datalist id={`group-name-list-${row.contactId}`}>
                          {groupNameOptions.map(groupName => (
                            <option key={groupName} value={groupName} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">{row.groupName || '-'}</span>
                    )}
                  </td>
                  {filterRole === 'helper' && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.isEditing ? (
                        <input
                          type="text"
                          value={row.position}
                          onChange={(e) => updateRow(row.contactId || '', 'position', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="崗位"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{row.position || '-'}</span>
                      )}
                    </td>
                  )}
                  {selectedEventDatesData.map(date => {
                    const regData = row.registrations.get(date.id);
                    const hasReg = !!regData;
                    return (
                      <td key={date.id} className="px-2 py-3 text-center">
                        {!row.isNew ? (
                          <input
                            type="checkbox"
                            checked={hasReg}
                            onChange={() => toggleRegistration(row.contactId!, date.id, regData)}
                            className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={hasReg}
                            onChange={() => {
                              const currentIndex = findRowIndexByContactId(row.contactId || '');
                              if (currentIndex !== -1) {
                                const updated = [...rows];
                                const newRegMap = new Map(updated[currentIndex].registrations);
                                if (hasReg) {
                                  newRegMap.delete(date.id);
                                } else {
                                  newRegMap.set(date.id, { regId: '', position: '' });
                                }
                                updated[currentIndex] = { ...updated[currentIndex], registrations: newRegMap };
                                setRows(updated);
                              }
                            }}
                            className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 whitespace-nowrap text-center sticky right-0 bg-white z-10">
                    {row.isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => saveRow(row.contactId || '')}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="儲存"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => cancelEdit(row.contactId || '')}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEdit(row.contactId || '')}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRow(row.contactId || '')}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={(filterRole === 'helper' ? 7 : 5) + selectedEventDatesData.length + 1} className="px-6 py-8 text-center text-gray-500">
                    {filterEvent === 'all' ? '請選擇活動以查看登記資料' : '暫無登記資料，點擊「新增登記」開始'}
                  </td>
                </tr>
              )}
              {filteredRows.length > 0 && (
                <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                  <td className="px-2 py-3 bg-blue-50"></td>
                  <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-blue-50 z-10">
                    總計
                  </td>
                  <td className="px-4 py-3"></td>
                  {filterRole !== 'helper' && <td className="px-4 py-3"></td>}
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  {filterRole === 'helper' && (
                    <>
                      <td className="px-4 py-3"></td>
                    </>
                  )}
                  {selectedEventDatesData.map(date => {
                    const count = filteredRows.filter(row => row.registrations.has(date.id)).length;
                    return (
                      <td key={date.id} className="px-4 py-3 text-center text-blue-900 font-bold">
                        {count}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 sticky right-0 bg-blue-50 z-10"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEvent && (
        <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-medium mb-2">使用說明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>點擊「新增登記」在表格頂部新增一行</li>
            <li>姓名欄位可直接輸入新名字，或從下拉選單選擇現有聯絡人</li>
            <li>選擇現有聯絡人時，相關資料會自動填入</li>
            <li>信仰狀況和來源群組欄位提供常用選項，也可自行輸入</li>
            <li>勾選日期欄位的核取方塊來登記該日期</li>
            <li>新增的聯絡人會自動加入聯絡人管理資料庫</li>
          </ul>
        </div>
      )}
    </div>
  );
}
