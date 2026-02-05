import { useState, useEffect } from 'react';
import { Filter, Download, FileText, ChevronDown, ChevronUp, Save, AlertCircle } from 'lucide-react';
import { supabase, Contact, FollowUp, Event } from '../lib/supabase';
import { exportToCSV, exportToPDFStructured, formatSeekerStatus } from '../lib/exportUtils';

type ContactEvent = {
  id: string;
  contact_id: string;
  event_id: string;
  created_at: string;
};

const SEEKER_STATUS_OPTIONS = [
  '1）純粹打發時間 或只是有興趣食飯',
  '2）因有家庭成員參加，所以跟著來',
  '3）較靜，不太願意分享',
  '4）個人性格較開放，但主要分享生活觀念/意見',
  '5）算積極分享，也會表達對信仰的看法',
  '6）慕道友，之前已聽過福音，對信仰較開放',
  '7）適宜安排探訪跟進（關係已建立，可深入關懷）',
  '8）適宜作個人佈道（對福音有興趣且開放接受）',
  '9）其他（請具體說明）'
];

const STATUS_OPTIONS = [
  '待跟進-需要個人關懷',
  '待跟進 - 需作栽培跟進',
  '待跟進 - 可繼續邀請參加聚會',
  '待跟進-可邀約個人佈道或探訪',
  '待確定跟進日期',
  '已完成跟進行動'
];

type FollowUpRow = {
  contactId: string;
  contactName: string;
  faithStatus: string;
  sourceGroup: string;
  followUpId?: string;
  groupLeader: string;
  seekerStatus: string;
  seekerStatusDetails: string;
  participationScore: number;
  participationNotes: string;
  status: string;
  responsiblePerson: string;
  nextFollowUpDate: string;
  actionNotes: string;
  isExpanded: boolean;
  expandedSection1: boolean;
  expandedSection5: boolean;
  hasChanges: boolean;
  isSaving: boolean;
  saveError?: string;
};

export function FollowUpManagement() {
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (contacts.length > 0) {
      buildRows();
    }
  }, [contacts, followUps, eventFilter]);

  async function loadData() {
    try {
      const [
        { data: followUpsData, error: followUpsError },
        { data: eventsData, error: eventsError },
        { data: contactsData, error: contactsError }
      ] = await Promise.all([
        supabase.from('follow_ups').select('*'),
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('role', 'attendee').order('name')
      ]);

      if (followUpsError) throw followUpsError;
      if (eventsError) throw eventsError;
      if (contactsError) throw contactsError;

      const attendeeContactIds = new Set((contactsData || []).map(c => c.id));

      const { data: contactEventsData, error: contactEventsError } = await supabase
        .from('contact_events')
        .select('*')
        .in('contact_id', Array.from(attendeeContactIds));

      if (contactEventsError) throw contactEventsError;

      setContacts(contactsData || []);
      setFollowUps(followUpsData || []);
      setEvents(eventsData || []);
      setContactEvents(contactEventsData || []);
    } catch (error) {
      console.error('載入資料失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildRows() {
    const newRows: FollowUpRow[] = [];

    for (const contact of contacts) {
      if (eventFilter !== 'all') {
        const hasEvent = contactEvents.some(
          ce => ce.contact_id === contact.id && ce.event_id === eventFilter
        );
        if (!hasEvent) continue;
      }

      const followUp = followUps.find(fu => fu.contact_id === contact.id);

      newRows.push({
        contactId: contact.id,
        contactName: contact.name,
        faithStatus: contact.faith_status || '',
        sourceGroup: contact.source_group || '',
        followUpId: followUp?.id,
        groupLeader: followUp?.group_leader || '',
        seekerStatus: followUp?.seeker_status || '',
        seekerStatusDetails: followUp?.seeker_status_details || '',
        participationScore: followUp?.participation_score || 0,
        participationNotes: followUp?.participation_notes || '',
        status: followUp?.status || '待跟進 - 可繼續邀請參加聚會',
        responsiblePerson: followUp?.responsible_person || '',
        nextFollowUpDate: followUp?.next_follow_up_date || '',
        actionNotes: followUp?.action_notes || '',
        isExpanded: false,
        expandedSection1: false,
        expandedSection5: true,
        hasChanges: false,
        isSaving: false,
        saveError: undefined
      });
    }

    setRows(newRows);
  }

  function findRowIndexByContactId(contactId: string): number {
    return rows.findIndex(row => row.contactId === contactId);
  }

  function updateRow(contactId: string, field: keyof FollowUpRow, value: any) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value, hasChanges: true };
    setRows(newRows);
  }

  function toggleExpanded(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], isExpanded: !newRows[index].isExpanded };
    setRows(newRows);
  }

  function toggleSection(contactId: string, section: 'expandedSection1' | 'expandedSection5') {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [section]: !newRows[index][section] };
    setRows(newRows);
  }

  async function saveRow(contactId: string) {
    const index = findRowIndexByContactId(contactId);
    if (index === -1) return;
    const row = rows[index];

    try {
      updateRow(contactId, 'isSaving', true);
      updateRow(contactId, 'saveError', undefined);

      if (row.followUpId) {
        const { error } = await supabase
          .from('follow_ups')
          .update({
            group_leader: row.groupLeader,
            seeker_status: row.seekerStatus,
            seeker_status_details: row.seekerStatusDetails,
            participation_score: row.participationScore || null,
            participation_notes: row.participationNotes,
            status: row.status,
            responsible_person: row.responsiblePerson,
            next_follow_up_date: row.nextFollowUpDate || null,
            action_notes: row.actionNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.followUpId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follow_ups')
          .insert([{
            contact_id: row.contactId,
            group_leader: row.groupLeader,
            seeker_status: row.seekerStatus,
            seeker_status_details: row.seekerStatusDetails,
            participation_score: row.participationScore || null,
            participation_notes: row.participationNotes,
            status: row.status,
            responsible_person: row.responsiblePerson,
            next_follow_up_date: row.nextFollowUpDate || null,
            action_notes: row.actionNotes
          }]);

        if (error) throw error;
      }

      const newRows = [...rows];
      newRows[index] = { ...newRows[index], hasChanges: false, isSaving: false, saveError: undefined };
      setRows(newRows);
    } catch (error) {
      console.error('保存失敗:', error);
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], isSaving: false, saveError: '保存失敗，請重試' };
      setRows(newRows);
    }
  }

  const filteredRows = rows.filter(row => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (nameFilter && !row.contactName.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  function handleExportCSV() {
    const exportData = filteredRows.map(row => ({
      '姓名': row.contactName,
      '信仰狀況': row.faithStatus || '',
      '來源群組': row.sourceGroup || '',
      '組長': row.groupLeader || '',
      '慕道狀態': formatSeekerStatus(row.seekerStatus),
      '狀態詳情': row.seekerStatusDetails || '',
      '參與程度': row.participationScore > 0 ? `${row.participationScore}/5` : '',
      '觀察筆記': row.participationNotes || '',
      '跟進狀態': row.status,
      '負責人': row.responsiblePerson || '',
      '跟進行動': row.actionNotes || '',
      '下次跟進日期': row.nextFollowUpDate ? new Date(row.nextFollowUpDate).toLocaleDateString('zh-TW') : ''
    }));
    exportToCSV(exportData, `跟進管理_${new Date().toLocaleDateString('zh-TW')}`);
  }

  function handleExportPDF() {
    const exportData = filteredRows.map(row => ({
      '姓名': row.contactName,
      '信仰狀況': row.faithStatus || '',
      '來源群組': row.sourceGroup || '',
      '組長': row.groupLeader || '',
      '慕道狀態': formatSeekerStatus(row.seekerStatus),
      '狀態詳情': row.seekerStatusDetails || '',
      '參與程度': row.participationScore > 0 ? `${row.participationScore}/5` : '',
      '觀察筆記': row.participationNotes || '',
      '跟進狀態': row.status,
      '負責人': row.responsiblePerson || '',
      '跟進行動': row.actionNotes || '',
      '下次跟進日期': row.nextFollowUpDate ? new Date(row.nextFollowUpDate).toLocaleDateString('zh-TW') : ''
    }));
    exportToPDFStructured(exportData, `跟進管理_${new Date().toLocaleDateString('zh-TW')}`);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">跟進管理</h2>
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
            onClick={handleExportPDF}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            列印PDF
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="搜尋姓名..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有狀態</option>
          {STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div id="followup-table" className="space-y-3">
        {filteredRows.length > 0 ? filteredRows.map((row) => (
          <div key={row.contactId} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div
              className="cursor-pointer bg-gradient-to-r from-blue-50 to-transparent hover:from-blue-100 p-4 flex items-center justify-between transition-colors"
              onClick={() => toggleExpanded(row.contactId)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`text-gray-600 transition-transform ${row.isExpanded ? 'rotate-180' : ''}`}>
                  {row.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold text-gray-900">{row.contactName}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    信仰狀況: {row.faithStatus || '-'} • 來源: {row.sourceGroup || '-'} • 狀態: <span className={`font-medium ${
                      row.status === '已完成跟進行動' ? 'text-green-600' :
                      row.status === '待確定跟進日期' ? 'text-yellow-600' :
                      row.status.startsWith('待跟進') ? 'text-orange-600' : 'text-gray-600'
                    }`}>{row.status}</span>
                  </div>
                </div>
              </div>
              {row.hasChanges && (
                <div className="flex items-center gap-2 text-orange-600 text-sm font-medium mr-4">
                  <AlertCircle className="w-4 h-4" />
                  未保存
                </div>
              )}
            </div>

            {row.isExpanded && (
              <div className="border-t border-gray-200 p-6 space-y-6">

                <section>
                  <button
                    onClick={() => toggleSection(row.contactId, 'expandedSection1')}
                    className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 mb-3 transition-colors"
                  >
                    {row.expandedSection1 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span>基本信息</span>
                  </button>
                  {row.expandedSection1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">信仰狀況</label>
                        <input
                          type="text"
                          value={row.faithStatus}
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">來源群組</label>
                        <input
                          type="text"
                          value={row.sourceGroup}
                          readOnly
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">小組信息</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">組長</label>
                      <input
                        type="text"
                        value={row.groupLeader}
                        onChange={(e) => updateRow(row.contactId, 'groupLeader', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="輸入組長名字"
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">慕道狀態</h3>
                  <div className="text-xs text-gray-600 mb-3">（可選多項，只憑直覺選擇即可）</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {SEEKER_STATUS_OPTIONS.map(option => (
                      <label key={option} className="flex items-start gap-2 cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={(row.seekerStatus || '').includes(option)}
                          onChange={(e) => {
                            const current = (row.seekerStatus || '').split('|').filter(Boolean);
                            if (e.target.checked) {
                              current.push(option);
                            } else {
                              current.splice(current.indexOf(option), 1);
                            }
                            updateRow(row.contactId, 'seekerStatus', current.join('|'));
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-0.5 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                  {row.seekerStatus?.includes('9）其他') && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">其他說明</label>
                      <textarea
                        value={row.seekerStatusDetails}
                        onChange={(e) => updateRow(row.contactId, 'seekerStatusDetails', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="請具體說明，例如：需要情感支持、生活幫助、職場壓力大、家庭問題等"
                      />
                    </div>
                  )}
                </section>

                <section className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">參與積極程度</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">參與程度評分 (1-5)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          value={row.participationScore}
                          onChange={(e) => updateRow(row.contactId, 'participationScore', parseInt(e.target.value) || 0)}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-lg font-bold text-blue-600 min-w-[2rem] text-right">
                          {row.participationScore === 0 ? '-' : row.participationScore}/5
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">觀察筆記</label>
                      <textarea
                        value={row.participationNotes}
                        onChange={(e) => updateRow(row.contactId, 'participationNotes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="記錄參與過程中的觀察"
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t pt-6">
                  <button
                    onClick={() => toggleSection(row.contactId, 'expandedSection5')}
                    className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 mb-4 transition-colors"
                  >
                    {row.expandedSection5 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span>跟進詳情</span>
                  </button>
                  {row.expandedSection5 && (
                    <div className="space-y-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">跟進狀態</label>
                        <select
                          value={row.status}
                          onChange={(e) => updateRow(row.contactId, 'status', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">負責人</label>
                        <input
                          type="text"
                          value={row.responsiblePerson}
                          onChange={(e) => updateRow(row.contactId, 'responsiblePerson', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="輸入負責人名字"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">跟進行動</label>
                        <textarea
                          value={row.actionNotes}
                          onChange={(e) => updateRow(row.contactId, 'actionNotes', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="詳細記錄跟進行動計劃"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">下次跟進日期</label>
                        <input
                          type="date"
                          value={row.nextFollowUpDate}
                          onChange={(e) => updateRow(row.contactId, 'nextFollowUpDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <div className="border-t pt-6 flex items-center justify-between">
                  {row.saveError && (
                    <div className="text-sm text-red-600 font-medium">{row.saveError}</div>
                  )}
                  {row.hasChanges && (
                    <button
                      onClick={() => saveRow(row.contactId)}
                      disabled={row.isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {row.isSaving ? '保存中...' : '保存'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-8 text-gray-500">沒有資料</div>
        )}
      </div>
    </div>
  );
}
