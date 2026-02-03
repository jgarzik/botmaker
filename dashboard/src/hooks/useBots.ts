import { useState, useEffect, useCallback } from 'react';
import type { Bot, CreateBotInput } from '../types';
import { fetchBots, createBot, deleteBot, startBot, stopBot } from '../api';

interface UseBotsReturn {
  bots: Bot[];
  loading: boolean;
  actionLoading: boolean;
  error: string;
  clearError: () => void;
  refresh: () => Promise<void>;
  handleCreate: (input: CreateBotInput) => Promise<void>;
  handleStart: (hostname: string) => Promise<void>;
  handleStop: (hostname: string) => Promise<void>;
  handleDelete: (hostname: string) => Promise<void>;
}

export function useBots(): UseBotsReturn {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBots = useCallback(async () => {
    try {
      const data = await fetchBots();
      setBots(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBots();

    // Poll for updates every 5 seconds
    const interval = setInterval(() => { void loadBots(); }, 5000);
    return () => { clearInterval(interval); };
  }, [loadBots]);

  const handleCreate = async (input: CreateBotInput) => {
    await createBot(input);
    await loadBots();
  };

  const handleStart = async (hostname: string) => {
    setActionLoading(true);
    try {
      await startBot(hostname);
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async (hostname: string) => {
    setActionLoading(true);
    try {
      await stopBot(hostname);
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (hostname: string) => {
    setActionLoading(true);
    try {
      await deleteBot(hostname);
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bot');
    } finally {
      setActionLoading(false);
    }
  };

  const clearError = () => { setError(''); };

  return {
    bots,
    loading,
    actionLoading,
    error,
    clearError,
    refresh: loadBots,
    handleCreate,
    handleStart,
    handleStop,
    handleDelete,
  };
}
