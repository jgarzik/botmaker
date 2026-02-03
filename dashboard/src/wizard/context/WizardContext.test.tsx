import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WizardProvider, useWizard, validatePage, buildCreateBotInput } from './WizardContext';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <WizardProvider>{children}</WizardProvider>
);

describe('WizardContext', () => {
  describe('useWizard hook', () => {
    it('provides initial state', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      expect(result.current.state.botName).toBe('');
      expect(result.current.state.emoji).toBe('🤖');
      expect(result.current.state.enabledProviders).toEqual([]);
      expect(result.current.state.enabledChannels).toEqual([]);
    });

    it('updates bot name', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_BOT_NAME', name: 'test-bot' });
      });

      expect(result.current.state.botName).toBe('test-bot');
    });

    it('updates emoji', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_EMOJI', emoji: '🚀' });
      });

      expect(result.current.state.emoji).toBe('🚀');
    });

    it('toggles provider on/off', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'TOGGLE_PROVIDER', providerId: 'openai' });
      });

      expect(result.current.state.enabledProviders).toContain('openai');
      expect(result.current.state.providerConfigs.openai).toBeDefined();

      act(() => {
        result.current.dispatch({ type: 'TOGGLE_PROVIDER', providerId: 'openai' });
      });

      expect(result.current.state.enabledProviders).not.toContain('openai');
    });

    it('toggles channel on/off', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'TOGGLE_CHANNEL', channelId: 'telegram' });
      });

      expect(result.current.state.enabledChannels).toContain('telegram');
      expect(result.current.state.channelConfigs.telegram).toBeDefined();

      act(() => {
        result.current.dispatch({ type: 'TOGGLE_CHANNEL', channelId: 'telegram' });
      });

      expect(result.current.state.enabledChannels).not.toContain('telegram');
    });

    it('sets provider config', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'TOGGLE_PROVIDER', providerId: 'openai' });
      });

      act(() => {
        result.current.dispatch({
          type: 'SET_PROVIDER_CONFIG',
          providerId: 'openai',
          config: { model: 'gpt-4' },
        });
      });

      expect(result.current.state.providerConfigs.openai?.model).toBe('gpt-4');
    });

    it('sets feature values', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_FEATURE', feature: 'tts', value: true });
      });

      expect(result.current.state.features.tts).toBe(true);
    });

    it('resets state', () => {
      const { result } = renderHook(() => useWizard(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_BOT_NAME', name: 'test' });
        result.current.dispatch({ type: 'TOGGLE_PROVIDER', providerId: 'openai' });
      });

      expect(result.current.state.botName).toBe('test');

      act(() => {
        result.current.dispatch({ type: 'RESET' });
      });

      expect(result.current.state.botName).toBe('');
      expect(result.current.state.enabledProviders).toEqual([]);
    });
  });

  describe('validatePage', () => {
    it('page 0 always valid', () => {
      const state = {
        selectedTemplateId: null,
        botName: '',
        hostname: '',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '',
        enabledProviders: [],
        enabledChannels: [],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: {},
        channelConfigs: {},
      };

      expect(validatePage(0, state).valid).toBe(true);
    });

    it('page 1 requires bot name', () => {
      const state = {
        selectedTemplateId: null,
        botName: '',
        hostname: '',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '',
        enabledProviders: [],
        enabledChannels: [],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: {},
        channelConfigs: {},
      };

      expect(validatePage(1, state).valid).toBe(false);
      expect(validatePage(1, state).error).toBe('Bot name is required');
    });

    it('page 1 validates hostname format', () => {
      const state = {
        selectedTemplateId: null,
        botName: 'My Bot',
        hostname: 'Invalid-Name!',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '',
        enabledProviders: [],
        enabledChannels: [],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: {},
        channelConfigs: {},
      };

      expect(validatePage(1, state).valid).toBe(false);
      expect(validatePage(1, state).error).toContain('lowercase');
    });

    it('page 2 requires provider and channel', () => {
      const state = {
        selectedTemplateId: null,
        botName: 'test-bot',
        hostname: 'test-bot',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '',
        enabledProviders: [],
        enabledChannels: [],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: {},
        channelConfigs: {},
      };

      const result = validatePage(2, state);
      expect(result.valid).toBe(false);
    });

    it('page 3 requires tokens', () => {
      const state = {
        selectedTemplateId: null,
        botName: 'test-bot',
        hostname: 'test-bot',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '',
        enabledProviders: ['openai'],
        enabledChannels: ['telegram'],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: { openai: { model: 'gpt-4' } },
        channelConfigs: { telegram: { token: '' } },
      };

      const result = validatePage(3, state);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token required');
    });
  });

  describe('buildCreateBotInput', () => {
    it('builds input from state', () => {
      const state = {
        selectedTemplateId: 'helpful-assistant',
        botName: 'My Bot',
        hostname: 'my-bot',
        emoji: '🤖',
        avatarFile: null,
        avatarPreviewUrl: '',
        soulMarkdown: '# Soul\nHelpful assistant',
        enabledProviders: ['openai'],
        enabledChannels: ['telegram'],
        routingTags: [],
        features: { commands: true, tts: false, ttsVoice: 'alloy', sandbox: false, sandboxTimeout: 30, sessionScope: 'user' as const },
        providerConfigs: { openai: { model: 'gpt-4' } },
        channelConfigs: { telegram: { token: 'tg-token' } },
      };

      const input = buildCreateBotInput(state);

      expect(input.name).toBe('My Bot');
      expect(input.hostname).toBe('my-bot');
      expect(input.emoji).toBe('🤖');
      expect(input.providers).toHaveLength(1);
      expect(input.providers[0].providerId).toBe('openai');
      expect(input.channels).toHaveLength(1);
      expect(input.channels[0].channelType).toBe('telegram');
      expect(input.persona.soulMarkdown).toBe('# Soul\nHelpful assistant');
    });
  });
});
