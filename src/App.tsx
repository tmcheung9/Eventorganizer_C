import { useState } from 'react';
import { Calendar, UserPlus, CheckCircle, MessageSquare, BarChart3, Church, Users, Settings, TrendingUp } from 'lucide-react';
import { TabNavigation } from './components/TabNavigation';
import { EventManagement } from './components/EventManagement';
import { RegistrationManagement } from './components/RegistrationManagement';
import { AttendanceTracking } from './components/AttendanceTracking';
import { FollowUpManagement } from './components/FollowUpManagement';
import { SummaryDashboard } from './components/SummaryDashboard';
import { ContactManagement } from './components/ContactManagement';
import { Statistics } from './components/Statistics';

function App() {
  const [activeTab, setActiveTab] = useState('registrations');

  const tabs = [
    { id: 'registrations', label: '報名管理', icon: UserPlus },
    { id: 'attendance', label: '出席記錄', icon: CheckCircle },
    { id: 'followup', label: '跟進管理', icon: MessageSquare },
    { id: 'summary', label: '統計摘要', icon: BarChart3 },
    {
      id: 'admin',
      label: '系統管理',
      icon: Settings,
      isDropdown: true as const,
      items: [
        { id: 'events', label: '活動管理', icon: Calendar },
        { id: 'contacts', label: '聯絡人管理', icon: Users },
        { id: 'statistics', label: '個人出席統計', icon: TrendingUp }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Church className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">教會活動籌辦系統</h1>
              <p className="text-sm text-gray-600 mt-1">Church Event Organizer</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="bg-white shadow-sm">
          {activeTab === 'summary' && <SummaryDashboard />}
          {activeTab === 'contacts' && <ContactManagement />}
          {activeTab === 'events' && <EventManagement />}
          {activeTab === 'registrations' && <RegistrationManagement />}
          {activeTab === 'attendance' && <AttendanceTracking />}
          {activeTab === 'followup' && <FollowUpManagement />}
          {activeTab === 'statistics' && <Statistics />}
        </main>
      </div>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500 text-sm">
        <p>教會活動籌辦系統 © 2025</p>
        <p className="mt-1 text-xs text-gray-400">Version 1.0.0</p>
      </footer>
    </div>
  );
}

export default App;
