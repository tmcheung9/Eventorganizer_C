import { useState, useEffect } from 'react';
import { Calendar, UserPlus, CheckCircle, MessageSquare, BarChart3, Church, Users, Settings, TrendingUp, Lock, AlertCircle } from 'lucide-react';
import { TabNavigation } from './components/TabNavigation';
import { EventManagement } from './components/EventManagement';
import { RegistrationManagement } from './components/RegistrationManagement';
import { AttendanceTracking } from './components/AttendanceTracking';
import { FollowUpManagement } from './components/FollowUpManagement';
import { SummaryDashboard } from './components/SummaryDashboard';
import { ContactManagement } from './components/ContactManagement';
import { Statistics } from './components/Statistics';
import { ConfigCheck } from './components/ConfigCheck';

const AUTH_KEY = 'church_event_auth';
const VALID_PASSWORD = '202607';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth === 'authenticated') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === VALID_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'authenticated');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('密碼錯誤');
      setPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-xl">
              <Church className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">教會活動籌辦系統</h1>
          <p className="text-center text-gray-500 mb-8">請輸入密碼以繼續</p>

          <form onSubmit={handleLogin}>
            <div className="relative mb-4">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="輸入密碼"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 mb-4 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              登入
            </button>
          </form>
        </div>
      </div>
    );
  }

  const configError = ConfigCheck();
  if (configError) return configError;

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
