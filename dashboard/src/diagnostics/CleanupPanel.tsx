import { useState, useEffect } from 'react';
import type { OrphanReport } from '../types';
import { fetchOrphans, runCleanup } from '../api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import './CleanupPanel.css';

export function CleanupPanel() {
  const [orphans, setOrphans] = useState<OrphanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadOrphans = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOrphans();
      setOrphans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orphan report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrphans();
  }, []);

  const handleCleanup = async () => {
    if (!orphans || orphans.total === 0) return;

    setCleaning(true);
    setError('');
    setResult(null);

    try {
      const report = await runCleanup();
      const total = report.containersRemoved + report.workspacesRemoved + report.secretsRemoved;
      setResult(`Cleaned up ${total} orphaned resources`);
      await loadOrphans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Panel className="cleanup-panel" header="Resource Cleanup">
      {loading ? (
        <div className="cleanup-panel-loading">
          <div className="cleanup-panel-spinner" />
          <span>Scanning for orphaned resources...</span>
        </div>
      ) : error ? (
        <div className="cleanup-panel-error">
          <span>{error}</span>
          <Button size="sm" onClick={() => { void loadOrphans(); }}>Retry</Button>
        </div>
      ) : (
        <>
          {result && (
            <div className="cleanup-panel-result">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 5.5l-5 5-2.5-2.5L5.5 6.5l1 1 3.5-3.5 1.5 1.5z" />
              </svg>
              <span>{result}</span>
            </div>
          )}

          <div className="cleanup-panel-summary">
            <div className="cleanup-panel-item">
              <span className="cleanup-panel-label">Orphaned Containers</span>
              <Badge variant={orphans && orphans.orphanedContainers.length > 0 ? 'warning' : 'default'}>
                {orphans?.orphanedContainers.length ?? 0}
              </Badge>
            </div>
            <div className="cleanup-panel-item">
              <span className="cleanup-panel-label">Orphaned Workspaces</span>
              <Badge variant={orphans && orphans.orphanedWorkspaces.length > 0 ? 'warning' : 'default'}>
                {orphans?.orphanedWorkspaces.length ?? 0}
              </Badge>
            </div>
            <div className="cleanup-panel-item">
              <span className="cleanup-panel-label">Orphaned Secrets</span>
              <Badge variant={orphans && orphans.orphanedSecrets.length > 0 ? 'warning' : 'default'}>
                {orphans?.orphanedSecrets.length ?? 0}
              </Badge>
            </div>
          </div>

          {orphans && orphans.total > 0 && (
            <div className="cleanup-panel-actions">
              <Button
                variant="danger"
                onClick={() => { void handleCleanup(); }}
                loading={cleaning}
                disabled={cleaning}
              >
                Clean Up {orphans.total} Resource{orphans.total !== 1 ? 's' : ''}
              </Button>
              <Button variant="ghost" onClick={() => { void loadOrphans(); }} disabled={cleaning}>
                Refresh
              </Button>
            </div>
          )}

          {orphans?.total === 0 && (
            <div className="cleanup-panel-clean">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span>No orphaned resources found</span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
