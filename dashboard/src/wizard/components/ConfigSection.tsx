import type { ReactNode } from 'react';
import './ConfigSection.css';

interface ConfigSectionProps {
  icon: string;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function ConfigSection({ icon, title, hint, children }: ConfigSectionProps) {
  return (
    <div className="config-section">
      <div className="config-section-header">
        <span className="config-section-icon">{icon}</span>
        <div className="config-section-title-group">
          <span className="config-section-title">{title}</span>
          {hint && <span className="config-section-hint">{hint}</span>}
        </div>
      </div>
      <div className="config-section-content">
        {children}
      </div>
    </div>
  );
}
