import { useTheme } from '../hooks/useTheme';
import './Header.css';

interface HeaderProps {
  onCreateClick?: () => void;
  onLogout?: () => void;
}

export function Header({ onCreateClick, onLogout }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const themeIcon = resolvedTheme === 'dark' ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );

  const themeLabel = theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="12" r="3" fill="currentColor" className="header-logo-eye" />
              <circle cx="22" cy="12" r="3" fill="currentColor" className="header-logo-eye" />
              <path d="M8 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 24h4M18 24h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="header-title">BotMaker</h1>
        </div>

        <div className="header-actions">
          <button
            className="header-theme-toggle"
            onClick={cycleTheme}
            aria-label={`Current theme: ${themeLabel}. Click to change.`}
            title={`Theme: ${themeLabel}`}
          >
            {themeIcon}
            <span className="header-theme-label">{themeLabel}</span>
          </button>

          {onCreateClick && (
            <button className="header-create-btn" onClick={onCreateClick}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 1v12M1 7h12" />
              </svg>
              <span>New Bot</span>
            </button>
          )}

          {onLogout && (
            <button className="header-logout-btn" onClick={onLogout} aria-label="Log out">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" />
              </svg>
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
