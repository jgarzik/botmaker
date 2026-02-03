import { useState, useEffect } from 'react';
import { checkHealth } from '../api';
import { Panel } from '../ui/Panel';
import { StatusLight } from '../ui/StatusLight';
import './HealthStatus.css';

export function HealthStatus() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<string>('');
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkHealthStatus = async () => {
    const start = Date.now();
    try {
      await checkHealth();
      setHealthy(true);
      setResponseTime(Date.now() - start);
    } catch {
      setHealthy(false);
      setResponseTime(null);
    }
    setLastCheck(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    void checkHealthStatus();
    const interval = setInterval(() => { void checkHealthStatus(); }, 30000);
    return () => { clearInterval(interval); };
  }, []);

  return (
    <Panel className="health-status" header="API Health">
      <div className="health-status-content">
        <div className="health-status-indicator">
          <StatusLight
            status={healthy === null ? 'created' : healthy ? 'running' : 'error'}
            size="lg"
          />
          <div className="health-status-info">
            <span className="health-status-label">
              {healthy === null ? 'Checking...' : healthy ? 'Healthy' : 'Unhealthy'}
            </span>
            {responseTime !== null && (
              <span className="health-status-latency">{responseTime}ms</span>
            )}
          </div>
        </div>
        {lastCheck && (
          <div className="health-status-meta">
            Last checked: {lastCheck}
          </div>
        )}
      </div>
    </Panel>
  );
}
