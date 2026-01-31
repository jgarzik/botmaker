import { useMemo } from 'react';
import type { Bot, BotStatus } from '../types';
import { StatusSection } from './StatusSection';
import { EmptyState } from './EmptyState';
import './DashboardTab.css';

interface DashboardTabProps {
  bots: Bot[];
  onStart: (hostname: string) => void;
  onStop: (hostname: string) => void;
  onDelete: (hostname: string) => void;
  onCreateClick: () => void;
  loading: boolean;
  actionLoading: boolean;
  error: string;
}

function getEffectiveStatus(bot: Bot): BotStatus {
  const containerState = bot.container_status?.state;
  if (containerState === 'running') return 'running';
  if (containerState === 'exited' || containerState === 'dead') {
    return bot.container_status?.exitCode === 0 ? 'stopped' : 'error';
  }
  return bot.status;
}

export function DashboardTab({
  bots,
  onStart,
  onStop,
  onDelete,
  onCreateClick,
  loading,
  actionLoading,
  error,
}: DashboardTabProps) {
  // Group bots by status
  const groupedBots = useMemo(() => {
    const groups: Record<BotStatus, Bot[]> = {
      running: [],
      stopped: [],
      error: [],
      created: [],
    };

    bots.forEach((bot) => {
      const status = getEffectiveStatus(bot);
      groups[status].push(bot);
    });

    return groups;
  }, [bots]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner" />
        <span>Loading bots...</span>
      </div>
    );
  }

  if (bots.length === 0) {
    return <EmptyState onCreateClick={onCreateClick} />;
  }

  return (
    <div className="dashboard-tab" role="tabpanel" id="dashboard-panel">
      {error && (
        <div className="dashboard-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <StatusSection
        status="running"
        bots={groupedBots.running}
        onStart={onStart}
        onStop={onStop}
        onDelete={onDelete}
        loading={actionLoading}
        defaultExpanded={true}
      />

      <StatusSection
        status="error"
        bots={groupedBots.error}
        onStart={onStart}
        onStop={onStop}
        onDelete={onDelete}
        loading={actionLoading}
        defaultExpanded={true}
      />

      <StatusSection
        status="stopped"
        bots={groupedBots.stopped}
        onStart={onStart}
        onStop={onStop}
        onDelete={onDelete}
        loading={actionLoading}
        defaultExpanded={true}
      />

      <StatusSection
        status="created"
        bots={groupedBots.created}
        onStart={onStart}
        onStop={onStop}
        onDelete={onDelete}
        loading={actionLoading}
        defaultExpanded={true}
      />
    </div>
  );
}
