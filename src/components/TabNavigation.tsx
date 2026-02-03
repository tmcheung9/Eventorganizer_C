import { useState } from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';

type TabItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type Tab = TabItem | {
  id: string;
  label: string;
  icon: LucideIcon;
  isDropdown: true;
  items: TabItem[];
};

type TabNavigationProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  function isDropdown(tab: Tab): tab is Tab & { isDropdown: true; items: TabItem[] } {
    return 'isDropdown' in tab && tab.isDropdown;
  }

  function isActiveInDropdown(tab: Tab): boolean {
    if (isDropdown(tab)) {
      return tab.items.some(item => item.id === activeTab);
    }
    return false;
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav className="flex space-x-1 px-4" aria-label="Tabs">
        {tabs.map((tab) => {
          if (isDropdown(tab)) {
            const Icon = tab.icon;
            const isActive = isActiveInDropdown(tab);
            const isOpen = openDropdown === tab.id;

            return (
              <div key={tab.id} className="relative">
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : tab.id)}
                  onBlur={() => setTimeout(() => setOpenDropdown(null), 200)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                    {tab.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id);
                            setOpenDropdown(null);
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors
                            ${isItemActive
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                            first:rounded-t-lg last:rounded-b-lg
                          `}
                        >
                          <ItemIcon className="w-4 h-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          }
        })}
      </nav>
    </div>
  );
}
