import { useState, useEffect } from 'react';
import { Plus, Save, X, Filter, Trash2, Edit2, Download, FileText, Upload } from 'lucide-react';
import { supabase, Contact, Event, Registration, EventDate } from '../lib/supabase';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';

type ContactEvent = {
  id: string;
  contact_id: string;
  event_id: string;
  created_at: string;
};

type EditableRow = {
  id?: string;
  name: string;
  role: 'attendee' | 'helper' | '';
  faithStatus: string;
  sourceGroup: string;
  groupName: string;
  notes: string;
  isBeliever: boolean;
  isNew: boolean;
  isEditing: boolean;
  selectedEvents?: string[];
};

export function ContactManagement() {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [faithStatusOptions, setFaithStatusOptions] = useState<string[]>([]);
  const [sourceGroupOptions, setSourceGroupOptions] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    role: '',
    faithStatus: '',
    sourceGroup: '',
    groupName: '',
    isBeliever: '',
    notes: ''
  });
  const [editingEventsForContact, setEditingEventsForContact] = useState<string | null>(null);
  const [selectedEventsForContact, setSelectedEventsForContact] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (!loading) {
      buildRows();
    }
  }, [roleFilter, eventFilter]);

  async function loadContacts() {
    try {
      const [
        { data: contactsData, error: contactsError },
        { data: eventsData, error: eventsError },
        { data: contactEventsData, error: contactEventsError },
        { data: registrationsData, error: registrationsError },
        { data: eventDatesData, error: eventDatesError }
      ] = await Promise.all([
        supabase.from('contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('contact_events').select('*'),
        supabase.from('registrations').select('*'),
        supabase.from('event_dates').select('*')
      ]);

      if (contactsError) throw contactsError;
      if (eventsError) throw eventsError;
      if (contactEventsError) throw contactEventsError;
      if (registrationsError) throw registrationsError;
      if (eventDatesError) throw eventDatesError;

      setEvents(eventsData || []);
      setContactEvents(contactEventsData || []);
      setRegistrations(registrationsData || []);
      setEventDates(eventDatesData || []);

      const faithStatuses = [...new Set(contactsData?.map(c => c.faith_status).filter(Boolean))];
      const sourceGroups = [...new Set(contactsData?.map(c => c.source_group).filter(Boolean))];
      setFaithStatusOptions(faithStatuses);
      setSourceGroupOptions(sourceGroups);

      buildRowsFromData(contactsData || [], contactEventsData || [], registrationsData || [], eventDatesData || []);
    } catch (error) {
      console.error('載入聯絡人失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildRowsFromData(contactsData: Contact[], contactEventsData: ContactEvent[], registrationsData: Registration[], eventDatesData: EventDate[]) {
    let filteredData = contactsData;

    if (eventFilter !== 'all') {
      const contactIdsInEvent = contactEventsData
        .filter(ce => ce.event_id === eventFilter)
        .map(ce => ce.contact_id);
      filteredData = filteredData.filter(c => contactIdsInEvent.includes(c.id));
    } else if (roleFilter !== 'all') {
      filteredData = contactsData.filter(c => c.role === roleFilter);
    }

    const editableRows: EditableRow[] = filteredData.map(contact => {
      let displayRole: 'attendee' | 'helper' | '' = '';

      if (eventFilter !== 'all') {
        const eventDateIdsForEvent = eventDatesData
          .filter(ed => ed.event_id === eventFilter)
          .map(ed => ed.id);

        const firstRegistration = registrationsData.find(
          r => r.contact_id === contact.id && eventDateIdsForEvent.includes(r.event_date_id)
        );

        if (firstRegistration && firstRegistration.role) {
          displayRole = firstRegistration.role as 'attendee' | 'helper';
        }
      }

      return {
        id: contact.id,
        name: contact.name,
        role: displayRole,
        faithStatus: contact.faith_status,
        sourceGroup: contact.source_group,
        groupName: contact.group_name,
        notes: contact.notes,
        isBeliever: contact.is_believer,
        isNew: false,
        isEditing: false
      };
    });

    const finalRows = roleFilter !== 'all' && eventFilter !== 'all'
      ? editableRows.filter(row => row.role === roleFilter)
      : editableRows;

    setRows(finalRows);
  }

  function buildRows() {
    loadContacts();
  }

  function addNewRow() {
    const newRow: EditableRow = {
      name: '',
      role: 'attendee',
      faithStatus: '',
      sourceGroup: '',
      groupName: '',
      notes: '',
      isBeliever: false,
      isNew: true,
      isEditing: true,
      selectedEvents: []
    };
    setRows([newRow, ...rows]);
  }

  function updateRow(index: number, field: keyof EditableRow, value: any) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  }

  function startEdit(index: number) {
    const updated = [...rows];
    updated[index] = { ...updated[index], isEditing: true };
    setRows(updated);
  }

  function cancelEdit(index: number) {
    if (rows[index].isNew) {
      setRows(rows.filter((_, i) => i !== index));
    } else {
      buildRows();
    }
  }

  async function saveRow(index: number) {
    const row = rows[index];
    if (!row.name.trim()) {
      alert('請輸入姓名');
      return;
    }

    try {
      if (row.isNew) {
        const { data, error } = await supabase
          .from('contacts')
          .insert([{
            name: row.name,
            role: row.role,
            faith_status: row.faithStatus,
            source_group: row.sourceGroup,
            group_name: row.groupName,
            notes: row.notes,
            is_believer: row.isBeliever
          }])
          .select()
          .single();

        if (error) throw error;

        if (row.selectedEvents && row.selectedEvents.length > 0 && data) {
          const { error: eventsError } = await supabase
            .from('contact_events')
            .insert(row.selectedEvents.map(eventId => ({
              contact_id: data.id,
              event_id: eventId
            })));

          if (eventsError) throw eventsError;
        }
      } else {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: row.name,
            role: row.role,
            faith_status: row.faithStatus,
            source_group: row.sourceGroup,
            group_name: row.groupName,
            notes: row.notes,
            is_believer: row.isBeliever,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id!);

        if (error) throw error;
      }

      await loadContacts();
    } catch (error) {
      console.error('儲存失敗:', error);
      alert('儲存失敗，請重試');
    }
  }

  async function deleteRow(index: number) {
    const row = rows[index];
    if (!row.id) return;

    if (!confirm(`確定要刪除 ${row.name} 嗎？這將同時刪除所有相關登記記錄。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', row.id);

      if (error) throw error;
      await loadContacts();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗，請重試');
    }
  }

  function startEditingEvents(contactId: string) {
    const contactEventIds = contactEvents
      .filter(ce => ce.contact_id === contactId)
      .map(ce => ce.event_id);
    setEditingEventsForContact(contactId);
    setSelectedEventsForContact(contactEventIds);
  }

  function cancelEditingEvents() {
    setEditingEventsForContact(null);
    setSelectedEventsForContact([]);
  }

  async function saveContactEvents(contactId: string) {
    try {
      const existingEventIds = contactEvents
        .filter(ce => ce.contact_id === contactId)
        .map(ce => ce.event_id);

      const toAdd = selectedEventsForContact.filter(id => !existingEventIds.includes(id));
      const toRemove = existingEventIds.filter(id => !selectedEventsForContact.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('contact_events')
          .delete()
          .eq('contact_id', contactId)
          .in('event_id', toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('contact_events')
          .insert(toAdd.map(eventId => ({
            contact_id: contactId,
            event_id: eventId
          })));
        if (error) throw error;
      }

      await loadContacts();
      setEditingEventsForContact(null);
      setSelectedEventsForContact([]);
    } catch (error) {
      console.error('儲存活動關聯失敗:', error);
      alert('儲存活動關聯失敗，請重試');
    }
  }

  function toggleEventForContact(eventId: string) {
    if (selectedEventsForContact.includes(eventId)) {
      setSelectedEventsForContact(selectedEventsForContact.filter(id => id !== eventId));
    } else {
      setSelectedEventsForContact([...selectedEventsForContact, eventId]);
    }
  }

  const filteredRows = rows.filter(row => {
    if (columnFilters.name && !row.name.toLowerCase().includes(columnFilters.name.toLowerCase())) return false;
    if (columnFilters.role && row.role !== columnFilters.role) return false;
    if (columnFilters.faithStatus && row.faithStatus !== columnFilters.faithStatus) return false;
    if (columnFilters.sourceGroup && row.sourceGroup !== columnFilters.sourceGroup) return false;
    if (columnFilters.groupName && !row.groupName.toLowerCase().includes(columnFilters.groupName.toLowerCase())) return false;
    if (columnFilters.isBeliever && ((columnFilters.isBeliever === 'true' && !row.isBeliever) || (columnFilters.isBeliever === 'false' && row.isBeliever))) return false;
    if (columnFilters.notes && !row.notes.toLowerCase().includes(columnFilters.notes.toLowerCase())) return false;
    return true;
  });

  function handleExportCSV() {
    const exportData = filteredRows.map(row => ({
      '姓名': row.name,
      '角色': row.role === '' ? '-' : (row.role === 'helper' ? '協助人員' : '參加者'),
      '信仰狀況': row.faithStatus || '-',
      '來源群組': row.sourceGroup || '-',
      '組別': row.groupName || '-',
      '已信者': row.isBeliever ? '是' : '否',
      '備註': row.notes || '-'
    }));
    exportToCSV(exportData, `聯絡人管理_${new Date().toLocaleDateString('zh-TW')}`);
  }

  function downloadCSVTemplate() {
    const template = [
      {
        '姓名': '範例姓名',
        '角色': '參加者',
        '信仰狀況': '慕道者',
        '來源群組': '教會A',
        '組別': '第一組',
        '已信者': '否',
        '備註': '備註內容',
        '活動名稱': '啟發二期_家嘗便飯'
      }
    ];

    const headers = ['姓名', '角色', '信仰狀況', '來源群組', '組別', '已信者', '備註', '活動名稱'];
    const instructions = [
      '# 聯絡人匯入範本',
      '# 說明：',
      '# - 姓名：必填，聯絡人姓名',
      '# - 角色：必填，請填寫「參加者」或「協助人員」',
      '# - 信仰狀況：選填',
      '# - 來源群組：選填',
      '# - 組別：選填',
      '# - 已信者：必填，請填寫「是」或「否」',
      '# - 備註：選填',
      '# - 活動名稱：選填，多個活動請用分號分隔，例如：活動A;活動B',
      '# ',
      '# 請從下一行開始填寫資料（保留標題行）：',
      ''
    ];

    const csvContent = instructions.join('\n') + '\n' +
      headers.join(',') + '\n' +
      template.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '聯絡人匯入範本.csv';
    link.click();
  }

  async function handleImportCSV() {
    if (!importFile) {
      alert('請選擇檔案');
      return;
    }

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      if (lines.length < 2) {
        alert('CSV檔案格式錯誤，請確認檔案內容');
        setImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const dataLines = lines.slice(1);

      const importedContacts = [];
      const contactEventMap: { [key: string]: string[] } = {};

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || [];

        if (values.length === 0) continue;

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        const name = rowData['姓名']?.trim();
        if (!name) continue;

        const role = rowData['角色']?.trim() === '協助人員' ? 'helper' : 'attendee';
        const isBeliever = rowData['已信者']?.trim() === '是';
        const eventNames = rowData['活動名稱']?.trim() || '';

        const contact = {
          name,
          role,
          faith_status: rowData['信仰狀況']?.trim() || '',
          source_group: rowData['來源群組']?.trim() || '',
          group_name: rowData['組別']?.trim() || '',
          notes: rowData['備註']?.trim() || '',
          is_believer: isBeliever
        };

        importedContacts.push(contact);

        if (eventNames) {
          const eventList = eventNames.split(';').map((e: string) => e.trim()).filter((e: string) => e);
          contactEventMap[name] = eventList;
        }
      }

      if (importedContacts.length === 0) {
        alert('沒有有效的資料可匯入');
        setImporting(false);
        return;
      }

      const { data: insertedContacts, error } = await supabase
        .from('contacts')
        .insert(importedContacts)
        .select();

      if (error) throw error;

      if (insertedContacts && insertedContacts.length > 0) {
        const contactEventInserts = [];

        for (const contact of insertedContacts) {
          const eventNames = contactEventMap[contact.name];
          if (eventNames && eventNames.length > 0) {
            for (const eventName of eventNames) {
              const event = events.find(e => e.name === eventName);
              if (event) {
                contactEventInserts.push({
                  contact_id: contact.id,
                  event_id: event.id
                });
              }
            }
          }
        }

        if (contactEventInserts.length > 0) {
          const { error: eventError } = await supabase
            .from('contact_events')
            .insert(contactEventInserts);

          if (eventError) {
            console.error('部分活動關聯建立失敗:', eventError);
          }
        }
      }

      alert(`成功匯入 ${insertedContacts?.length || 0} 筆聯絡人`);
      setShowImportModal(false);
      setImportFile(null);
      await loadContacts();
    } catch (error) {
      console.error('匯入失敗:', error);
      alert('匯入失敗，請檢查檔案格式');
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">聯絡人管理</h2>
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
            onClick={() => exportToPDF('contact-table', '聯絡人管理')}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            列印PDF
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            匯入CSV
          </button>
          <button
            onClick={addNewRow}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            新增聯絡人
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Filter className="w-5 h-5 text-gray-500" />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有活動</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有成員</option>
          <option value="attendee">參加者</option>
          <option value="helper">協助人員</option>
        </select>
      </div>

      <div id="contact-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>姓名</div>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>組別</div>
                  <input
                    type="text"
                    value={columnFilters.groupName}
                    onChange={(e) => setColumnFilters({ ...columnFilters, groupName: e.target.value })}
                    placeholder="篩選..."
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>已信者</div>
                  <select
                    value={columnFilters.isBeliever}
                    onChange={(e) => setColumnFilters({ ...columnFilters, isBeliever: e.target.value })}
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="">全部</option>
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </select>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  活動
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>備註</div>
                  <input
                    type="text"
                    value={columnFilters.notes}
                    onChange={(e) => setColumnFilters({ ...columnFilters, notes: e.target.value })}
                    placeholder="篩選..."
                    className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.length > 0 ? filteredRows.map((row, index) => (
                <tr key={row.id || `new-${index}`} className={`hover:bg-gray-50 ${row.isNew ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(index, 'name', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="姓名"
                      />
                    ) : (
                      <span className="text-base font-semibold text-gray-900">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <select
                        value={row.role}
                        onChange={(e) => updateRow(index, 'role', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="attendee">參加者</option>
                        <option value="helper">協助人員</option>
                      </select>
                    ) : row.role === '' ? (
                      <span className="text-gray-400 text-sm">-</span>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        row.role === 'helper' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {row.role === 'helper' ? '協助人員' : '參加者'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <>
                        <input
                          type="text"
                          list={`faith-status-list-${index}`}
                          value={row.faithStatus}
                          onChange={(e) => updateRow(index, 'faithStatus', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="信仰狀況"
                        />
                        <datalist id={`faith-status-list-${index}`}>
                          {faithStatusOptions.map(status => (
                            <option key={status} value={status} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">{row.faithStatus || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <>
                        <input
                          type="text"
                          list={`source-group-list-${index}`}
                          value={row.sourceGroup}
                          onChange={(e) => updateRow(index, 'sourceGroup', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="來源群組"
                        />
                        <datalist id={`source-group-list-${index}`}>
                          {sourceGroupOptions.map(group => (
                            <option key={group} value={group} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">{row.sourceGroup || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.isEditing ? (
                      <input
                        type="text"
                        value={row.groupName}
                        onChange={(e) => updateRow(index, 'groupName', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="組別"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">{row.groupName || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {row.isEditing ? (
                      <input
                        type="checkbox"
                        checked={row.isBeliever}
                        onChange={(e) => updateRow(index, 'isBeliever', e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        row.isBeliever ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {row.isBeliever ? '是' : '否'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.isNew ? (
                      <div className="relative">
                        <select
                          multiple
                          size={Math.min(events.length, 5)}
                          value={row.selectedEvents || []}
                          onChange={(e) => {
                            const selectedOptions = Array.from(e.target.selectedOptions).map(opt => opt.value);
                            updateRow(index, 'selectedEvents', selectedOptions);
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {events.map(event => (
                            <option key={event.id} value={event.id} className="py-1">
                              {event.name}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-xs text-gray-500">
                          按住 Ctrl/Cmd 可選擇多個活動
                        </div>
                      </div>
                    ) : row.id && editingEventsForContact === row.id ? (
                      <div className="space-y-2">
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {events.map(event => (
                            <label key={event.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedEventsForContact.includes(event.id)}
                                onChange={() => toggleEventForContact(event.id)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-gray-700">{event.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveContactEvents(row.id!)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            儲存
                          </button>
                          <button
                            onClick={cancelEditingEvents}
                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {row.id && (
                          <>
                            <div className="text-sm text-gray-600 mb-1">
                              {contactEvents
                                .filter(ce => ce.contact_id === row.id)
                                .map(ce => events.find(e => e.id === ce.event_id)?.name)
                                .filter(Boolean)
                                .join(', ') || '-'}
                            </div>
                            <button
                              onClick={() => startEditingEvents(row.id!)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              編輯活動
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.isEditing ? (
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateRow(index, 'notes', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="備註"
                      />
                    ) : (
                      <span className="text-sm text-gray-600 truncate max-w-xs block">{row.notes || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {row.isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => saveRow(index)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="儲存"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => cancelEdit(index)}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEdit(index)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRow(index)}
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
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    暫無聯絡人資料，點擊「新增聯絡人」開始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-medium mb-2">使用說明：</p>
        <ul className="list-disc list-inside space-y-1">
          <li>點擊「新增聯絡人」在表格頂部新增一行，輸入資料後點擊儲存圖示</li>
          <li>點擊編輯圖示可修改現有聯絡人資料</li>
          <li>所有欄位都可直接在表格中編輯</li>
        </ul>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">匯入聯絡人</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-gray-700 mb-2">
                  請先下載CSV範本，填寫資料後再匯入
                </p>
                <button
                  onClick={downloadCSVTemplate}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  下載CSV範本
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選擇CSV檔案
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    已選擇：{importFile.name}
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  disabled={importing}
                >
                  取消
                </button>
                <button
                  onClick={handleImportCSV}
                  disabled={!importFile || importing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {importing ? '匯入中...' : '開始匯入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
