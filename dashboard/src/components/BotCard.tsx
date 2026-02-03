import type { Bot } from '../types';

interface BotCardProps {
  bot: Bot;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'running':
      return 'status-running';
    case 'stopped':
    case 'exited':
      return 'status-stopped';
    case 'error':
    case 'dead':
      return 'status-error';
    default:
      return 'status-created';
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BotCard({ bot, onStart, onStop, onDelete, loading }: BotCardProps) {
  const containerState = bot.container_status?.state ?? bot.status;
  const isRunning = bot.container_status?.running ?? bot.status === 'running';

  return (
    <div className="bot-card">
      <div className="bot-card-header">
        <h3>{bot.name}</h3>
        <span className={`status-badge ${getStatusClass(containerState)}`}>
          {containerState}
        </span>
      </div>

      <div className="bot-card-info">
        <p>
          <strong>Model:</strong> {bot.ai_provider} / {bot.model}
        </p>
        <p>
          <span className="channel-badge">
            {bot.channel_type === 'telegram' ? '📱' : '💬'} {bot.channel_type}
          </span>
        </p>
        <p>
          <strong>Created:</strong> {formatDate(bot.created_at)}
        </p>
      </div>

      <div className="bot-card-actions">
        {isRunning ? (
          <button
            className="btn btn-small"
            onClick={() => { onStop(bot.id); }}
            disabled={loading}
          >
            Stop
          </button>
        ) : (
          <button
            className="btn btn-small btn-primary"
            onClick={() => { onStart(bot.id); }}
            disabled={loading}
          >
            Start
          </button>
        )}
        <button
          className="btn btn-small btn-danger"
          onClick={() => {
            if (confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) {
              onDelete(bot.id);
            }
          }}
          disabled={loading}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
