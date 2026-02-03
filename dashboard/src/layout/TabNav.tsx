import './TabNav.css';

export type TabId = 'dashboard' | 'diagnostics' | 'secrets';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="7" width="10" height="8" rx="1" />
        <path d="M5 7V5a3 3 0 116 0v2" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1v14" />
        <path d="M1 8h14" />
        <circle cx="8" cy="8" r="6" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    ),
  },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="tab-nav" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-nav-item ${activeTab === tab.id ? 'tab-nav-item--active' : ''}`}
          onClick={() => { onTabChange(tab.id); }}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
        >
          <span className="tab-nav-icon">{tab.icon}</span>
          <span className="tab-nav-label">{tab.label}</span>
          {activeTab === tab.id && <span className="tab-nav-indicator" />}
        </button>
      ))}
    </nav>
  );
}
