import { useState } from 'react';
import type { Bot, BotStatus } from '../types';
import { StatusLight } from '../ui/StatusLight';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Panel } from '../ui/Panel';
import { TokenDisplay } from '../ui/TokenDisplay';
import { BotLink } from '../ui/BotLink';
import './BotCard.css';

interface BotCardProps {
  bot: Bot;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

function getEffectiveStatus(bot: Bot): BotStatus {
  const containerState = bot.container_status?.state;
  if (containerState === 'running') return 'running';
  if (containerState === 'exited' || containerState === 'dead') {
    return bot.container_status?.exitCode === 0 ? 'stopped' : 'error';
  }
  return bot.status;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const channelIcons: Record<string, string> = {
  telegram: 'TG',
  discord: 'DC',
};

export function BotCard({ bot, onStart, onStop, onDelete, loading }: BotCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = getEffectiveStatus(bot);
  const isRunning = status === 'running';

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(bot.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <Panel className="bot-card" variant="raised">
      <div className="bot-card-header">
        <div className="bot-card-status">
          <StatusLight status={status} size="md" />
        </div>
        <div className="bot-card-title">
          <h3>{bot.name}</h3>
          <span className="bot-card-model">{bot.model}</span>
        </div>
        <Badge
          variant={bot.channel_type === 'telegram' ? 'primary' : 'default'}
          className="bot-card-channel"
        >
          {channelIcons[bot.channel_type] || bot.channel_type.substring(0, 2).toUpperCase()}
        </Badge>
      </div>

      <div className="bot-card-details">
        <div className="bot-card-detail">
          <span className="bot-card-detail-label">Provider</span>
          <span className="bot-card-detail-value">{bot.ai_provider}</span>
        </div>
        <div className="bot-card-detail">
          <span className="bot-card-detail-label">Created</span>
          <span className="bot-card-detail-value">{formatDate(bot.created_at)}</span>
        </div>
        {bot.port && (
          <div className="bot-card-detail">
            <span className="bot-card-detail-label">Port</span>
            <span className="bot-card-detail-value">{bot.port}</span>
          </div>
        )}
      </div>

      {bot.port && isRunning && (
        <div className="bot-card-link">
          <BotLink port={bot.port} />
        </div>
      )}

      {bot.gateway_token && (
        <div className="bot-card-token">
          <TokenDisplay token={bot.gateway_token} />
        </div>
      )}

      <div className="bot-card-actions">
        {isRunning ? (
          <Button
            size="sm"
            onClick={() => onStop(bot.id)}
            disabled={loading}
            loading={loading}
          >
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onStart(bot.id)}
            disabled={loading}
            loading={loading}
          >
            Start
          </Button>
        )}
        <Button
          size="sm"
          variant={confirmDelete ? 'danger' : 'ghost'}
          onClick={handleDelete}
          disabled={loading}
        >
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </Button>
      </div>
    </Panel>
  );
}
