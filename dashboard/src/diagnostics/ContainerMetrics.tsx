import type { ContainerStats } from '../types';
import { Panel } from '../ui/Panel';
import { Gauge } from '../ui/Gauge';
import './ContainerMetrics.css';

interface ContainerMetricsProps {
  stats: ContainerStats[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function extractBotName(containerName: string): string {
  return containerName.replace('botmaker-', '').substring(0, 8) + '...';
}

export function ContainerMetrics({ stats }: ContainerMetricsProps) {
  if (stats.length === 0) {
    return (
      <Panel className="container-metrics" header="Container Metrics">
        <div className="container-metrics-empty">
          <span>No running containers</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="container-metrics" header="Container Metrics" noPadding>
      <div className="container-metrics-table">
        <div className="container-metrics-header">
          <span>Container</span>
          <span>CPU</span>
          <span>Memory</span>
          <span>Net In/Out</span>
        </div>
        {stats.map((stat) => (
          <div key={stat.hostname} className="container-metrics-row">
            <div className="container-metrics-name">
              <span className="container-metrics-id" title={stat.hostname}>
                {extractBotName(stat.name)}
              </span>
            </div>
            <div className="container-metrics-gauge">
              <Gauge
                value={stat.cpuPercent}
                max={100}
                size="sm"
                showValue={true}
                thresholds={{ warning: 60, danger: 85 }}
              />
            </div>
            <div className="container-metrics-gauge">
              <Gauge
                value={stat.memoryPercent}
                max={100}
                size="sm"
                showValue={true}
                thresholds={{ warning: 70, danger: 90 }}
              />
            </div>
            <div className="container-metrics-network">
              <span className="container-metrics-network-in">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M5 0L9 4H6v6H4V4H1L5 0z" />
                </svg>
                {formatBytes(stat.networkRxBytes)}
              </span>
              <span className="container-metrics-network-out">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M5 10L1 6H4V0h2v6h3L5 10z" />
                </svg>
                {formatBytes(stat.networkTxBytes)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
