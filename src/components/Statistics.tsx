import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Calendar, Filter, Download, FileText } from 'lucide-react';
import { supabase, Contact, Event, EventDate, Registration, Attendance } from '../lib/supabase';
import { exportToCSV, exportToPDFStructured } from '../lib/exportUtils';

type ContactStats = {
  contact: Contact;
  eventAttendance: Map<string, {
    event: Event;
    dates: {
      date: EventDate;
      attended: boolean;
    }[];
  }>;
  totalAttended: number;
  totalRegistered: number;
};

export function Statistics() {
  const [stats, setStats] = useState<ContactStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    loadStatistics();
  }, [periodFilter, eventFilter]);

  async function loadStatistics() {
    try {
      setLoading(true);

      const [
        { data: contactsData, error: contactsError },
        { data: eventsData, error: eventsError },
        { data: datesData, error: datesError },
        { data: regsData, error: regsError },
        { data: attendanceData, error: attendanceError }
      ] = await Promise.all([
        supabase.from('contacts').select('*').order('name'),
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('event_dates').select('*').order('event_date', { ascending: false }),
        supabase.from('registrations').select('*'),
        supabase.from('attendance').select('*')
      ]);

      if (contactsError) throw contactsError;
      if (eventsError) throw eventsError;
      if (datesError) throw datesError;
      if (regsError) throw regsError;
      if (attendanceError) throw attendanceError;

      setEvents(eventsData || []);

      const now = new Date();
      let startDate = new Date(0);

      if (periodFilter === '3months') {
        startDate = new Date(now.setMonth(now.getMonth() - 3));
      } else if (periodFilter === '6months') {
        startDate = new Date(now.setMonth(now.getMonth() - 6));
      } else if (periodFilter === '9months') {
        startDate = new Date(now.setMonth(now.getMonth() - 9));
      } else if (periodFilter === '1year') {
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      }

      const filteredDates = (datesData || []).filter(date => {
        const dateTime = new Date(date.event_date);
        if (periodFilter !== 'all' && dateTime < startDate) return false;
        if (eventFilter !== 'all' && date.event_id !== eventFilter) return false;
        return true;
      });

      const contactStats: ContactStats[] = (contactsData || []).map(contact => {
        const eventAttendance = new Map<string, {
          event: Event;
          dates: { date: EventDate; attended: boolean; }[];
        }>();

        let totalAttended = 0;
        let totalRegistered = 0;

        filteredDates.forEach(eventDate => {
          const event = eventsData?.find(e => e.id === eventDate.event_id);
          if (!event) return;

          const registration = regsData?.find(r =>
            r.contact_id === contact.id && r.event_date_id === eventDate.id
          );

          if (registration) {
            totalRegistered++;
            const attendance = attendanceData?.find(a => a.registration_id === registration.id);
            const attended = attendance?.attended || false;

            if (attended) totalAttended++;

            if (!eventAttendance.has(event.id)) {
              eventAttendance.set(event.id, {
                event,
                dates: []
              });
            }

            eventAttendance.get(event.id)!.dates.push({
              date: eventDate,
              attended
            });
          }
        });

        return {
          contact,
          eventAttendance,
          totalAttended,
          totalRegistered
        };
      }).filter(stat => stat.totalRegistered > 0);

      setStats(contactStats);
    } catch (error) {
      console.error('載入統計資料失敗:', error);
      alert('載入統計資料失敗');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(contactId: string) {
    const newExpanded = new Set(expandedContacts);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
    }
    setExpandedContacts(newExpanded);
  }

  function handleExportCSV() {
    const exportData = filteredStats.map(stat => {
      const attendanceRate = stat.totalRegistered > 0
        ? Math.round((stat.totalAttended / stat.totalRegistered) * 100)
        : 0;

      return {
        '姓名': stat.contact.name,
        '信仰狀態': stat.contact.faith_status || '',
        '來源群體': stat.contact.source_group || '',
        '出席率': `${attendanceRate}%`,
        '出席次數': stat.totalAttended.toString(),
        '報名次數': stat.totalRegistered.toString(),
        '出席/報名': `${stat.totalAttended}/${stat.totalRegistered}`
      };
    });
    exportToCSV(exportData, `個人出席統計_${new Date().toLocaleDateString('zh-TW')}`);
  }

  function handleExportPDF() {
    const exportData = filteredStats.map(stat => {
      const attendanceRate = stat.totalRegistered > 0
        ? Math.round((stat.totalAttended / stat.totalRegistered) * 100)
        : 0;

      return {
        '姓名': stat.contact.name,
        '信仰狀態': stat.contact.faith_status || '',
        '來源群體': stat.contact.source_group || '',
        '出席率': `${attendanceRate}%`,
        '出席次數': stat.totalAttended.toString(),
        '報名次數': stat.totalRegistered.toString(),
        '出席/報名': `${stat.totalAttended}/${stat.totalRegistered}`
      };
    });
    exportToPDFStructured(exportData, `個人出席統計_${new Date().toLocaleDateString('zh-TW')}`);
  }

  const filteredStats = stats.filter(stat =>
    stat.contact.name.toLowerCase().includes(nameFilter.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center">載入中...</div>;
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">個人出席統計</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredStats.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            匯出CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredStats.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            列印PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-700">篩選條件</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">時間範圍</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部時間</option>
              <option value="3months">近 3 個月</option>
              <option value="6months">近 6 個月</option>
              <option value="9months">近 9 個月</option>
              <option value="1year">近 1 年</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">活動</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部活動</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名搜尋</label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="輸入姓名..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出席率</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出席/報名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">信仰狀態</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">來源群體</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">詳情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    無統計資料
                  </td>
                </tr>
              ) : (
                filteredStats.map(stat => {
                  const isExpanded = expandedContacts.has(stat.contact.id);
                  const attendanceRate = stat.totalRegistered > 0
                    ? Math.round((stat.totalAttended / stat.totalRegistered) * 100)
                    : 0;

                  return (
                    <>
                      <tr key={stat.contact.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-base font-semibold text-gray-900">{stat.contact.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  attendanceRate >= 80 ? 'bg-green-500' :
                                  attendanceRate >= 50 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${attendanceRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">{attendanceRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.totalAttended} / {stat.totalRegistered}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {stat.contact.faith_status || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {stat.contact.source_group || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleExpand(stat.contact.id)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                收起
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                展開
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {Array.from(stat.eventAttendance.values()).map(eventData => (
                                <div key={eventData.event.id} className="border-l-4 border-blue-500 pl-4">
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {eventData.event.name}
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {eventData.dates.map(dateInfo => (
                                      <div
                                        key={dateInfo.date.id}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                          dateInfo.attended
                                            ? 'bg-green-100 text-green-800 border border-green-300'
                                            : 'bg-red-100 text-red-800 border border-red-300'
                                        }`}
                                      >
                                        {new Date(dateInfo.date.event_date).toLocaleDateString('zh-TW')}
                                        <span className="ml-2">
                                          {dateInfo.attended ? '✓' : '✗'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">使用說明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 點擊「展開」查看個人詳細出席記錄</li>
          <li>• 綠色標籤表示已出席，紅色標籤表示缺席</li>
          <li>• 使用篩選條件可以查看特定時間範圍或活動的統計</li>
          <li>• 點擊「匯出CSV」可下載完整統計報告，點擊「列印PDF」可生成可列印的報告</li>
        </ul>
      </div>
    </div>
  );
}
