import { useState, type ReactNode } from 'react';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`collapsible-section ${isOpen ? 'collapsible-section--open' : ''}`}>
      <button
        type="button"
        className="collapsible-section-header"
        onClick={() => { setIsOpen(!isOpen); }}
      >
        <span className="collapsible-section-title">{title}</span>
        <svg
          className="collapsible-section-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.22 5.72a.75.75 0 011.06 0L8 8.44l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 6.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
      {isOpen && (
        <div className="collapsible-section-content">
          {children}
        </div>
      )}
    </div>
  );
}
