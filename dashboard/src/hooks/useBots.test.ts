import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBots } from './useBots';
import * as api from '../api';

// Mock the API module
vi.mock('../api', () => ({
  fetchBots: vi.fn(),
  createBot: vi.fn(),
  deleteBot: vi.fn(),
  startBot: vi.fn(),
  stopBot: vi.fn(),
}));

describe('useBots', () => {
  const mockBots = [
    {
      id: '1',
      name: 'Bot 1',
      hostname: 'bot-1',
      ai_provider: 'openai',
      model: 'gpt-4',
      channel_type: 'telegram',
      container_id: 'container-1',
      port: 3001,
      gateway_token: 'token-1',
      status: 'running' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Bot 2',
      hostname: 'bot-2',
      ai_provider: 'anthropic',
      model: 'claude-3',
      channel_type: 'discord',
      container_id: null,
      port: null,
      gateway_token: null,
      status: 'stopped' as const,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.mocked(api.fetchBots).mockResolvedValue(mockBots);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load bots on mount', async () => {
    const { result } = renderHook(() => useBots());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bots).toEqual(mockBots);
    expect(result.current.error).toBe('');
  });

  it('should set error on fetch failure', async () => {
    vi.mocked(api.fetchBots).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should clear error', async () => {
    vi.mocked(api.fetchBots).mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.error).toBe('Error');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe('');
  });

  it('should refresh bots', async () => {
    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(api.fetchBots).toHaveBeenCalledTimes(2);
  });

  it('should handle create', async () => {
    vi.mocked(api.createBot).mockResolvedValueOnce({
      id: '3',
      name: 'New Bot',
      hostname: 'new-bot',
      ai_provider: 'openai',
      model: 'gpt-4',
      channel_type: 'telegram',
      container_id: null,
      port: null,
      gateway_token: null,
      status: 'created' as const,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    });

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const input = {
      name: 'New Bot',
      hostname: 'new-bot',
      emoji: '🤖',
      providers: [{ providerId: 'openai', apiKey: 'sk', model: 'gpt-4' }],
      primaryProvider: 'openai',
      channels: [{ channelType: 'telegram', token: 'tk' }],
      persona: { name: 'New Bot', soulMarkdown: 'test' },
      features: { commands: false, tts: false, sandbox: false, sessionScope: 'user' as const },
    };

    await act(async () => {
      await result.current.handleCreate(input);
    });

    expect(api.createBot).toHaveBeenCalledWith(input);
  });

  it('should handle start', async () => {
    vi.mocked(api.startBot).mockResolvedValueOnce();

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleStart('bot-1');
    });

    expect(result.current.actionLoading).toBe(false);
    expect(api.startBot).toHaveBeenCalledWith('bot-1');
  });

  it('should handle start error', async () => {
    vi.mocked(api.startBot).mockRejectedValueOnce(new Error('Start failed'));

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleStart('bot-1');
    });

    expect(result.current.error).toBe('Start failed');
    expect(result.current.actionLoading).toBe(false);
  });

  it('should handle stop', async () => {
    vi.mocked(api.stopBot).mockResolvedValueOnce();

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleStop('bot-1');
    });

    expect(api.stopBot).toHaveBeenCalledWith('bot-1');
  });

  it('should handle delete', async () => {
    vi.mocked(api.deleteBot).mockResolvedValueOnce();

    const { result } = renderHook(() => useBots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleDelete('bot-1');
    });

    expect(api.deleteBot).toHaveBeenCalledWith('bot-1');
  });
});
