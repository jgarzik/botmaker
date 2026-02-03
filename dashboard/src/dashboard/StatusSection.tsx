import { useState } from 'react';
import type { Bot, BotStatus } from '../types';
import { BotCard } from './BotCard';
import { StatusLight } from '../ui/StatusLight';
import './StatusSection.css';

interface StatusSectionProps {
  status: BotStatus;
  bots: Bot[];
  onStart: (hostname: string) => void;
  onStop: (hostname: string) => void;
  onDelete: (hostname: string) => void;
  loading: boolean;
  defaultExpanded?: boolean;
}

const statusTitles: Record<BotStatus, string> = {
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
  error: 'Error',
  created: 'Created',
};

export function StatusSection({
  status,
  bots,
  onStart,
  onStop,
  onDelete,
  loading,
  defaultExpanded = true,
}: StatusSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (bots.length === 0) return null;

  return (
    <section className="status-section">
      <button
        className="status-section-header"
        onClick={() => { setExpanded(!expanded); }}
        aria-expanded={expanded}
      >
        <div className="status-section-title">
          <StatusLight status={status} size="sm" />
          <h2>{statusTitles[status]}</h2>
          <span className="status-section-count">{bots.length}</span>
        </div>
        <svg
          className={`status-section-chevron ${expanded ? 'status-section-chevron--expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="status-section-content">
          <div className="status-section-grid">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onStart={onStart}
                onStop={onStop}
                onDelete={onDelete}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
