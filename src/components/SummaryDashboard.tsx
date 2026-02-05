import { useState, useEffect } from 'react';
import { Users, CheckCircle, UserCheck, Filter, ChevronDown, ChevronRight, Heart, ListChecks, Download, FileText } from 'lucide-react';
import { supabase, Event, EventDate } from '../lib/supabase';
import { exportToCSV, exportToPDFStructured } from '../lib/exportUtils';

type FollowUpBreakdown = {
  '待跟進-慕道階段': number;
  '待跟進-需要個人關懷': number;
  '待跟進- 可繼續邀請參加聚會': number;
  '待跟進-可邀約個人佈道或探訪': number;
  '待確定跟進日期': number;
  '已完成跟進行動': number;
};

type EventSummary = {
  event: Event;
  eventDate: EventDate;
  attendees: number;
  helpers: number;
  attended: number;
  totalAttended: number;
  decisionCount: number;
  followUpPending: number;
  followUpBreakdown?: FollowUpBreakdown;
  isExpanded: boolean;
};

type AggregatedStats = {
  uniquePersons: number;
  uniqueAttendees: number;
  uniqueHelpers: number;
  uniqueAttended: number;
  totalDecisions: number;
  totalFollowUpPending: number;
};

export function SummaryDashboard() {
  const [summaries, setSummaries] = useState<EventSummary[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterEventDate, setFilterEventDate] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'aggregated' | 'by-date'>('aggregated');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [
        { data: eventsData, error: eventsError },
        { data: eventDatesData, error: datesError },
        { data: registrationsData, error: regsError },
        { data: contactsData, error: contactsError },
        { data: attendanceData, error: attendanceError },
        { data: followUpsData, error: followUpsError }
      ] = await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('event_dates').select('*').order('event_date'),
        supabase.from('registrations').select('*'),
        supabase.from('contacts').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('follow_ups').select('*')
      ]);

      if (eventsError) throw eventsError;
      if (datesError) throw datesError;
      if (regsError) throw regsError;
      if (contactsError) throw contactsError;
      if (attendanceError) throw attendanceError;
      if (followUpsError) throw followUpsError;

      const summaryData: EventSummary[] = [];

      for (const eventDate of eventDatesData || []) {
        const event = eventsData?.find(e => e.id === eventDate.event_id);
        if (!event) continue;

        const dateRegistrations = registrationsData?.filter(r => r.event_date_id === eventDate.id) || [];
        const attendees = dateRegistrations.filter(r => r.role === 'attendee');
        const helpers = dateRegistrations.filter(r => r.role === 'helper');

        const attendedAttendees = dateRegistrations.filter(r => {
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return r.role === 'attendee' && attendance?.attended === true;
        });

        const attendedHelpers = dateRegistrations.filter(r => {
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return r.role === 'helper' && attendance?.attended === true;
        });

        const totalAttended = attendedAttendees.length + attendedHelpers.length;

        const dateString = new Date(eventDate.event_date).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric'
        });

        const attendedContactIds = dateRegistrations
          .filter(r => {
            const attendance = attendanceData?.find(a => a.registration_id === r.id);
            return attendance?.attended === true;
          })
          .map(r => r.contact_id);

        const decisionCount = contactsData?.filter(c =>
          attendedContactIds.includes(c.id) &&
          c.faith_status?.includes('決志') &&
          c.faith_status?.includes(dateString)
        ).length || 0;

        const followUpPending = followUpsData?.filter(f =>
          f.status !== '已完成跟進行動' &&
          f.status &&
          dateRegistrations.some(r => r.contact_id === f.contact_id)
        ).length || 0;

        summaryData.push({
          event,
          eventDate,
          attendees: attendees.length,
          helpers: attendedHelpers.length,
          attended: attendedAttendees.length,
          totalAttended,
          decisionCount,
          followUpPending,
          isExpanded: false
        });
      }

      setSummaries(summaryData);
      setEvents(eventsData || []);
      setEventDates(eventDatesData || []);
    } catch (error) {
      console.error('載入統計資料失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowUpBreakdown(eventDateId: string): Promise<FollowUpBreakdown> {
    try {
      const { data: registrationsData } = await supabase
        .from('registrations')
        .select('id, contact_id')
        .eq('event_date_id', eventDateId);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('registration_id')
        .eq('attended', true);

      const attendedContactIds = registrationsData
        ?.filter(r => attendanceData?.some(a => a.registration_id === r.id))
        .map(r => r.contact_id) || [];

      const { data: followUpsData } = await supabase
        .from('follow_ups')
        .select('status, contact_id')
        .in('contact_id', attendedContactIds);

      const breakdown: FollowUpBreakdown = {
        '待跟進-慕道階段': 0,
        '待跟進-需要個人關懷': 0,
        '待跟進- 可繼續邀請參加聚會': 0,
        '待跟進-可邀約個人佈道或探訪': 0,
        '待確定跟進日期': 0,
        '已完成跟進行動': 0
      };

      followUpsData?.forEach(f => {
        if (f.status in breakdown) {
          breakdown[f.status as keyof FollowUpBreakdown]++;
        }
      });

      return breakdown;
    } catch (error) {
      console.error('載入跟進分解資料失敗:', error);
      return {
        '待跟進-慕道階段': 0,
        '待跟進-需要個人關懷': 0,
        '待跟進- 可繼續邀請參加聚會': 0,
        '待跟進-可邀約個人佈道或探訪': 0,
        '待確定跟進日期': 0,
        '已完成跟進行動': 0
      };
    }
  }

  async function toggleRowExpansion(index: number) {
    const updatedSummaries = [...summaries];
    const summary = updatedSummaries[index];

    if (!summary.isExpanded && !summary.followUpBreakdown) {
      summary.followUpBreakdown = await loadFollowUpBreakdown(summary.eventDate.id);
    }

    summary.isExpanded = !summary.isExpanded;
    setSummaries(updatedSummaries);
  }

  const selectedEvent = filterEvent !== 'all' ? events.find(e => e.id === filterEvent) : null;
  const availableEventDates = selectedEvent
    ? eventDates.filter(d => d.event_id === selectedEvent.id)
    : [];

  const filteredSummaries = filterEventDate !== 'all'
    ? summaries.filter(s => s.eventDate.id === filterEventDate)
    : filterEvent !== 'all'
    ? summaries.filter(s => s.event.id === filterEvent)
    : summaries;

  async function calculateAggregatedStats(): Promise<AggregatedStats> {
    const { data: registrationsData } = await supabase.from('registrations').select('*');
    const { data: contactsData } = await supabase.from('contacts').select('*');
    const { data: attendanceData } = await supabase.from('attendance').select('*');
    const { data: followUpsData } = await supabase.from('follow_ups').select('*');

    const relevantRegs = registrationsData?.filter(r =>
      filteredSummaries.some(s => s.eventDate.id === r.event_date_id)
    ) || [];

    const uniqueContactIds = new Set(relevantRegs.map(r => r.contact_id));
    const uniqueAttendeeIds = new Set(
      relevantRegs
        .filter(r => r.role === 'attendee')
        .map(r => r.contact_id)
    );
    const uniqueHelperIds = new Set(
      relevantRegs
        .filter(r => {
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return r.role === 'helper' && attendance?.attended === true;
        })
        .map(r => r.contact_id)
    );

    const uniqueAttendedIds = new Set(
      relevantRegs
        .filter(r => {
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return r.role === 'attendee' && attendance?.attended === true;
        })
        .map(r => r.contact_id)
    );

    const totalDecisions = filteredSummaries.reduce((sum, s) => sum + s.decisionCount, 0);

    const totalFollowUpPending = followUpsData?.filter(f =>
      f.status !== '已完成跟進行動' &&
      f.status &&
      relevantRegs.some(r => r.contact_id === f.contact_id)
    ).length || 0;

    return {
      uniquePersons: uniqueContactIds.size,
      uniqueAttendees: uniqueAttendeeIds.size,
      uniqueHelpers: uniqueHelperIds.size,
      uniqueAttended: uniqueAttendedIds.size,
      totalDecisions,
      totalFollowUpPending
    };
  }

  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats>({
    uniquePersons: 0,
    uniqueAttendees: 0,
    uniqueHelpers: 0,
    uniqueAttended: 0,
    totalDecisions: 0,
    totalFollowUpPending: 0
  });

  useEffect(() => {
    if (!loading && filteredSummaries.length > 0) {
      calculateAggregatedStats().then(setAggregatedStats);
    }
  }, [filteredSummaries.length, loading]);

  const totalStats = filteredSummaries.reduce((acc, s) => ({
    totalAttendees: acc.totalAttendees + s.attendees,
    totalHelpers: acc.totalHelpers + s.helpers,
    totalAttended: acc.totalAttended + s.attended,
    totalAttendedBoth: acc.totalAttendedBoth + s.totalAttended,
    totalDecisions: acc.totalDecisions + s.decisionCount,
    totalFollowUpPending: acc.totalFollowUpPending + s.followUpPending
  }), {
    totalAttendees: 0,
    totalHelpers: 0,
    totalAttended: 0,
    totalAttendedBoth: 0,
    totalDecisions: 0,
    totalFollowUpPending: 0
  });

  function handleExportCSV() {
    if (filteredSummaries.length === 0) {
      alert('沒有資料可以匯出');
      return;
    }

    const csvData = filteredSummaries.map(summary => {
      const attendanceRate = summary.attendees > 0
        ? Math.round((summary.attended / summary.attendees) * 100)
        : 0;

      return {
        '活動名稱': summary.event.name,
        '日期': new Date(summary.eventDate.event_date).toLocaleDateString('zh-TW'),
        '參加者登記': summary.attendees,
        '參加者出席': summary.attended,
        '參加者出席率': `${attendanceRate}%`,
        '協助者出席': summary.helpers,
        '總出席人數': summary.totalAttended,
        '決志人數': summary.decisionCount,
        '跟進狀態:待跟進': summary.followUpPending
      };
    });

    const fileName = `統計摘要_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}`;
    exportToCSV(csvData, fileName);
  }

  function handleExportPDF() {
    if (filteredSummaries.length === 0) {
      alert('沒有資料可以匯出');
      return;
    }

    const pdfData = filteredSummaries.map(summary => {
      const attendanceRate = summary.attendees > 0
        ? Math.round((summary.attended / summary.attendees) * 100)
        : 0;

      return {
        '活動名稱': summary.event.name,
        '日期': new Date(summary.eventDate.event_date).toLocaleDateString('zh-TW'),
        '參加者登記': summary.attendees,
        '參加者出席': summary.attended,
        '參加者出席率': `${attendanceRate}%`,
        '協助者出席': summary.helpers,
        '總出席人數': summary.totalAttended,
        '決志人數': summary.decisionCount,
        '跟進狀態:待跟進': summary.followUpPending
      };
    });

    const fileName = `統計摘要_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}`;
    exportToPDFStructured(pdfData, fileName);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">統計摘要</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredSummaries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            匯出CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredSummaries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            列印PDF
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Filter className="w-5 h-5 text-gray-500" />
        <select
          value={filterEvent}
          onChange={(e) => {
            setFilterEvent(e.target.value);
            setFilterEventDate('all');
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有活動</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>

        {selectedEvent && availableEventDates.length > 0 && (
          <select
            value={filterEventDate}
            onChange={(e) => setFilterEventDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有日期</option>
            {availableEventDates.map(date => (
              <option key={date.id} value={date.id}>
                {new Date(date.event_date).toLocaleDateString('zh-TW')}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('aggregated')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'aggregated'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            按人數統計
          </button>
          <button
            onClick={() => setViewMode('by-date')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'by-date'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            按日期統計
          </button>
        </div>
      </div>

      {viewMode === 'aggregated' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">參加者登記人數</h3>
                <Users className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-3xl font-bold">{aggregatedStats.uniqueAttendees}</p>
              <p className="text-xs opacity-75 mt-1">
                協助人員出席: {aggregatedStats.uniqueHelpers}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">參加者出席人數</h3>
                <CheckCircle className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-3xl font-bold">{aggregatedStats.uniqueAttended}</p>
              <p className="text-xs opacity-75 mt-1">
                參加者出席率: {aggregatedStats.uniqueAttendees > 0
                  ? Math.round((aggregatedStats.uniqueAttended / aggregatedStats.uniqueAttendees) * 100)
                  : 0}%
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">決志人數</h3>
                <Heart className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-3xl font-bold">{aggregatedStats.totalDecisions}</p>
              <p className="text-xs opacity-75 mt-1">
                跟進狀態:待跟進: {aggregatedStats.totalFollowUpPending}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
            <p className="text-sm text-gray-600">
              以上統計顯示的是<span className="font-semibold text-gray-900">參加者實際人數</span>（去重複後），而非登記次數。
              例如：同一人登記參加 3 個日期，只計算為 1 人。協助人員的統計會另外顯示。
            </p>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">參加者登記人次</h3>
              <Users className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-3xl font-bold">{totalStats.totalAttendees}</p>
            <p className="text-xs opacity-75 mt-1">
              協助人員: {totalStats.totalHelpers}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">參加者出席人次</h3>
              <CheckCircle className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-3xl font-bold">{totalStats.totalAttended}</p>
            <p className="text-xs opacity-75 mt-1">
              參加者出席率: {totalStats.totalAttendees > 0
                ? Math.round((totalStats.totalAttended / totalStats.totalAttendees) * 100)
                : 0}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">決志人次</h3>
              <Heart className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-3xl font-bold">{totalStats.totalDecisions}</p>
            <p className="text-xs opacity-75 mt-1">
              跟進狀態:待跟進: {totalStats.totalFollowUpPending}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">各場次詳細統計</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">

                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  活動名稱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  參加者登記
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  參加者出席
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  參加者出席率
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  協助者出席
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  總出席人數
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  決志人數
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  跟進狀態:待跟進
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSummaries.map((summary, index) => {
                const attendanceRate = summary.attendees > 0
                  ? Math.round((summary.attended / summary.attendees) * 100)
                  : 0;

                return (
                  <>
                    <tr key={`row-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleRowExpansion(index)}
                          className="text-gray-400 hover:text-gray-600 transition-transform duration-200"
                          style={{
                            transform: summary.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {summary.event.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(summary.eventDate.event_date).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                        {summary.attendees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600 font-semibold">
                        {summary.attended}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          attendanceRate >= 80 ? 'bg-green-100 text-green-800' :
                          attendanceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {attendanceRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                        {summary.helpers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600 font-semibold">
                        {summary.totalAttended}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-orange-600 font-semibold">
                        {summary.decisionCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-semibold">
                        {summary.followUpPending}
                      </td>
                    </tr>
                    {summary.isExpanded && (
                      <tr key={`detail-${index}`} className="bg-blue-50">
                        <td colSpan={10} className="px-6 py-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                <ListChecks className="w-5 h-5 text-blue-600" />
                                <h4 className="text-sm font-semibold text-gray-800">跟進狀態分解</h4>
                              </div>
                              {summary.followUpBreakdown ? (
                                <div className="grid grid-cols-2 gap-3">
                                  {Object.entries(summary.followUpBreakdown).map(([status, count]) => (
                                    <div
                                      key={status}
                                      className="flex items-center justify-between p-2 rounded border border-gray-200"
                                    >
                                      <span className="text-xs text-gray-700">{status}</span>
                                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        status.startsWith('待跟進') ? 'bg-yellow-100 text-yellow-800' :
                                        status === '已完成跟進行動' ? 'bg-green-100 text-green-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {count}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">載入中...</div>
                              )}
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                <Heart className="w-5 h-5 text-orange-600" />
                                <h4 className="text-sm font-semibold text-gray-800">決志資訊</h4>
                              </div>
                              <div className="text-center py-4">
                                <div className="text-4xl font-bold text-orange-600 mb-2">
                                  {summary.decisionCount}
                                </div>
                                <div className="text-sm text-gray-600">
                                  於此活動決志
                                  <div className="text-xs text-gray-500 mt-1">
                                    ({new Date(summary.eventDate.event_date).toLocaleDateString('en-US', {
                                      month: 'numeric',
                                      day: 'numeric'
                                    })})
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
