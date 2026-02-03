import { useState, useEffect } from 'react';
import { Users, CheckCircle, UserCheck, Filter } from 'lucide-react';
import { supabase, Event, EventDate } from '../lib/supabase';

type EventSummary = {
  event: Event;
  eventDate: EventDate;
  totalRegistrations: number;
  attendees: number;
  helpers: number;
  attended: number;
  nonBelievers: number;
  followUpPending: number;
};

type AggregatedStats = {
  uniquePersons: number;
  uniqueAttendees: number;
  uniqueHelpers: number;
  uniqueAttended: number;
  uniqueNonBelievers: number;
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

        const attendedTotal = dateRegistrations.filter(r => {
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return attendance?.attended === true;
        });

        const attendedNonBelievers = dateRegistrations.filter(r => {
          const contact = contactsData?.find(c => c.id === r.contact_id);
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return contact?.is_believer === false && r.role === 'attendee' && attendance?.attended === true;
        });

        const followUpPending = followUpsData?.filter(f =>
          f.status === '待跟進' &&
          dateRegistrations.some(r => r.contact_id === f.contact_id)
        ).length || 0;

        summaryData.push({
          event,
          eventDate,
          totalRegistrations: dateRegistrations.length,
          attendees: attendees.length,
          helpers: attendedHelpers.length,
          attended: attendedAttendees.length,
          nonBelievers: attendedNonBelievers.length,
          followUpPending
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

    const uniqueNonBelieverIds = new Set(
      relevantRegs
        .filter(r => {
          const contact = contactsData?.find(c => c.id === r.contact_id);
          const attendance = attendanceData?.find(a => a.registration_id === r.id);
          return contact?.is_believer === false && r.role === 'attendee' && attendance?.attended === true;
        })
        .map(r => r.contact_id)
    );

    const totalFollowUpPending = followUpsData?.filter(f =>
      f.status === '待跟進' &&
      relevantRegs.some(r => r.contact_id === f.contact_id)
    ).length || 0;

    return {
      uniquePersons: uniqueContactIds.size,
      uniqueAttendees: uniqueAttendeeIds.size,
      uniqueHelpers: uniqueHelperIds.size,
      uniqueAttended: uniqueAttendedIds.size,
      uniqueNonBelievers: uniqueNonBelieverIds.size,
      totalFollowUpPending
    };
  }

  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats>({
    uniquePersons: 0,
    uniqueAttendees: 0,
    uniqueHelpers: 0,
    uniqueAttended: 0,
    uniqueNonBelievers: 0,
    totalFollowUpPending: 0
  });

  useEffect(() => {
    if (!loading && filteredSummaries.length > 0) {
      calculateAggregatedStats().then(setAggregatedStats);
    }
  }, [filteredSummaries.length, loading]);

  const totalStats = filteredSummaries.reduce((acc, s) => ({
    totalRegistrations: acc.totalRegistrations + s.totalRegistrations,
    totalAttendees: acc.totalAttendees + s.attendees,
    totalHelpers: acc.totalHelpers + s.helpers,
    totalAttended: acc.totalAttended + s.attended,
    totalNonBelievers: acc.totalNonBelievers + s.nonBelievers,
    totalFollowUpPending: acc.totalFollowUpPending + s.followUpPending
  }), {
    totalRegistrations: 0,
    totalAttendees: 0,
    totalHelpers: 0,
    totalAttended: 0,
    totalNonBelievers: 0,
    totalFollowUpPending: 0
  });

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">統計摘要</h2>

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
                <h3 className="text-sm font-medium opacity-90">未信者出席人數</h3>
                <UserCheck className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-3xl font-bold">{aggregatedStats.uniqueNonBelievers}</p>
              <p className="text-xs opacity-75 mt-1">
                待跟進: {aggregatedStats.totalFollowUpPending}
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
              <h3 className="text-sm font-medium opacity-90">未信者人次</h3>
              <UserCheck className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-3xl font-bold">{totalStats.totalNonBelievers}</p>
            <p className="text-xs opacity-75 mt-1">
              待跟進: {totalStats.totalFollowUpPending}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  活動名稱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  總登記
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
                  未信者出席
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  待跟進
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSummaries.map((summary, index) => {
                const attendanceRate = summary.attendees > 0
                  ? Math.round((summary.attended / summary.attendees) * 100)
                  : 0;

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {summary.event.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(summary.eventDate.event_date).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                      {summary.totalRegistrations}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-orange-600 font-semibold">
                      {summary.nonBelievers}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-semibold">
                      {summary.followUpPending}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
