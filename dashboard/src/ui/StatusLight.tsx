import type { BotStatus } from '../types';
import './StatusLight.css';

export type StatusLightSize = 'sm' | 'md' | 'lg';

interface StatusLightProps {
  status: BotStatus;
  size?: StatusLightSize;
  label?: string;
  showLabel?: boolean;
}

const statusLabels: Record<BotStatus, string> = {
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
  error: 'Error',
  created: 'Created',
};

export function StatusLight({
  status,
  size = 'md',
  label,
  showLabel = false,
}: StatusLightProps) {
  const displayLabel = label ?? statusLabels[status];

  return (
    <div className={`status-light-container status-light-${size}`}>
      <span
        className={`status-light status-light--${status}`}
        role="status"
        aria-label={displayLabel}
      />
      {showLabel && (
        <span className="status-light-label">{displayLabel}</span>
      )}
    </div>
  );
}
