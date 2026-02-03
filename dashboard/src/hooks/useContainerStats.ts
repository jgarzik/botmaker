import { useState, useEffect, useCallback } from 'react';
import type { ContainerStats } from '../types';
import { fetchContainerStats } from '../api';

interface UseContainerStatsReturn {
  stats: ContainerStats[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds

export function useContainerStats(): UseContainerStatsReturn {
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchContainerStats();
      setStats(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load container stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();

    // Poll for updates every 30 seconds
    const interval = setInterval(() => { void loadStats(); }, POLLING_INTERVAL);
    return () => { clearInterval(interval); };
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats,
  };
}
