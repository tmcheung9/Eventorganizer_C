import { useState, useEffect } from 'react';
import { Plus, Calendar, Edit2, Trash2, X } from 'lucide-react';
import { supabase, Event, EventDate } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateUtils';

type EventWithDates = Event & {
  event_dates: EventDate[];
};

export function EventManagement() {
  const [events, setEvents] = useState<EventWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithDates | null>(null);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventDates, setNewEventDates] = useState<string[]>([]);
  const [datePickerValue, setDatePickerValue] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      const { data: datesData, error: datesError } = await supabase
        .from('event_dates')
        .select('*')
        .order('event_date', { ascending: true });

      if (datesError) throw datesError;

      const eventsWithDates = eventsData?.map(event => ({
        ...event,
        event_dates: datesData?.filter(d => d.event_id === event.id) || []
      })) || [];

      setEvents(eventsWithDates);
    } catch (error) {
      console.error('載入活動失敗:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAddDate() {
    if (!datePickerValue) return;

    if (!newEventDates.includes(datePickerValue)) {
      setNewEventDates([...newEventDates, datePickerValue].sort());
    }
    setDatePickerValue('');
  }

  function handleRemoveDate(dateToRemove: string) {
    setNewEventDates(newEventDates.filter(d => d !== dateToRemove));
  }

  async function handleAddEvent() {
    if (!newEventName.trim()) return;

    try {
      if (editingEvent) {
        const { error: eventError } = await supabase
          .from('events')
          .update({
            name: newEventName,
            description: newEventDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEvent.id);

        if (eventError) throw eventError;

        const existingDates = editingEvent.event_dates.map(d => d.event_date);
        const datesToAdd = newEventDates.filter(d => !existingDates.includes(d));
        const datesToRemove = editingEvent.event_dates.filter(d => !newEventDates.includes(d.event_date));

        if (datesToRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('event_dates')
            .delete()
            .in('id', datesToRemove.map(d => d.id));

          if (deleteError) throw deleteError;
        }

        if (datesToAdd.length > 0) {
          const dateInserts = datesToAdd.map(date => ({
            event_id: editingEvent.id,
            event_date: date
          }));

          const { error: insertError } = await supabase
            .from('event_dates')
            .insert(dateInserts);

          if (insertError) throw insertError;
        }
      } else {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert([{ name: newEventName, description: newEventDescription }])
          .select()
          .single();

        if (eventError) throw eventError;

        if (newEventDates.length > 0 && eventData) {
          const dateInserts = newEventDates.map(date => ({
            event_id: eventData.id,
            event_date: date
          }));

          const { error: datesError } = await supabase
            .from('event_dates')
            .insert(dateInserts);

          if (datesError) throw datesError;
        }
      }

      resetForm();
      loadEvents();
    } catch (error) {
      console.error('儲存活動失敗:', error);
      alert('儲存活動失敗，請重試');
    }
  }

  function resetForm() {
    setNewEventName('');
    setNewEventDescription('');
    setNewEventDates([]);
    setDatePickerValue('');
    setShowAddModal(false);
    setEditingEvent(null);
  }

  function startEdit(event: EventWithDates) {
    setEditingEvent(event);
    setNewEventName(event.name);
    setNewEventDescription(event.description);
    setNewEventDates(event.event_dates.map(d => d.event_date));
    setShowAddModal(true);
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('確定要刪除此活動嗎？這將同時刪除所有相關日期和登記資料。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      loadEvents();
    } catch (error) {
      console.error('刪除活動失敗:', error);
      alert('刪除活動失敗，請重試');
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">活動管理</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新增活動
        </button>
      </div>

      <div className="grid gap-4">
        {events.map(event => (
          <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{event.name}</h3>
                {event.description && (
                  <p className="text-gray-600 mt-1">{event.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(event)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="編輯"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {event.event_dates.map(date => (
                <div
                  key={date.id}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  {parseLocalDate(date.event_date).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={resetForm}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{editingEvent ? '編輯活動' : '新增活動'}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  活動名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入活動名稱"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  活動描述
                </label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入活動描述"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  活動日期
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={datePickerValue}
                    onChange={(e) => setDatePickerValue(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    加入
                  </button>
                </div>

                {newEventDates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700">已選擇的日期：</p>
                    <div className="flex flex-wrap gap-2">
                      {newEventDates.map((date) => (
                        <div
                          key={date}
                          className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>
                            {parseLocalDate(date).toLocaleDateString('zh-TW', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDate(date)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleAddEvent}
                disabled={!newEventName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingEvent ? '儲存變更' : '確認新增'}
              </button>
              <button
                type="button"
                onClick={resetForm}
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
