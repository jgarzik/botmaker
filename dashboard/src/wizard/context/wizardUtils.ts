import type { SessionScope, CreateBotInput } from '../../types';

export interface WizardState {
  selectedTemplateId: string | null;
  botName: string;
  hostname: string;
  emoji: string;
  avatarFile: File | null;
  avatarPreviewUrl: string;
  soulMarkdown: string;
  enabledProviders: string[];
  enabledChannels: string[];
  routingTags: string[];
  features: {
    commands: boolean;
    tts: boolean;
    ttsVoice: string;
    sandbox: boolean;
    sandboxTimeout: number;
    sessionScope: SessionScope;
  };
  providerConfigs: Record<string, { model?: string } | undefined>;
  channelConfigs: Record<string, { token: string } | undefined>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePage(page: number, state: WizardState): ValidationResult {
  switch (page) {
    case 0:
      // Templates - no required selection
      return { valid: true };

    case 1:
      // Personality
      if (!state.botName.trim()) {
        return { valid: false, error: 'Bot name is required' };
      }
      if (!state.hostname.trim()) {
        return { valid: false, error: 'Hostname is required' };
      }
      if (!/^[a-z0-9-]+$/.test(state.hostname)) {
        return { valid: false, error: 'Hostname must be lowercase letters, numbers, and hyphens only' };
      }
      if (state.hostname.length < 2) {
        return { valid: false, error: 'Hostname must be at least 2 characters' };
      }
      if (state.hostname.length > 64) {
        return { valid: false, error: 'Hostname must be at most 64 characters' };
      }
      return { valid: true };

    case 2:
      // Toggles
      if (state.enabledProviders.length === 0) {
        return { valid: false, error: 'Select at least one LLM provider' };
      }
      if (state.enabledChannels.length === 0) {
        return { valid: false, error: 'Select at least one channel' };
      }
      return { valid: true };

    case 3:
      // Config details
      for (const channelId of state.enabledChannels) {
        const config = state.channelConfigs[channelId];
        if (!config?.token.trim()) {
          return { valid: false, error: `Token required for ${channelId}` };
        }
      }
      return { valid: true };

    case 4:
      // Summary - review only
      return { valid: true };

    default:
      return { valid: true };
  }
}

export function buildCreateBotInput(state: WizardState): CreateBotInput {
  const providers = state.enabledProviders.map((providerId) => ({
    providerId,
    model: state.providerConfigs[providerId]?.model ?? '',
  }));

  const channels = state.enabledChannels.map((channelType) => ({
    channelType,
    token: state.channelConfigs[channelType]?.token ?? '',
  }));

  return {
    name: state.botName,
    hostname: state.hostname,
    emoji: state.emoji,
    avatarUrl: state.avatarPreviewUrl || undefined,
    providers,
    primaryProvider: state.enabledProviders[0] || '',
    channels,
    persona: {
      name: state.botName,
      soulMarkdown: state.soulMarkdown,
    },
    features: {
      commands: state.features.commands,
      tts: state.features.tts,
      ttsVoice: state.features.tts ? state.features.ttsVoice : undefined,
      sandbox: state.features.sandbox,
      sandboxTimeout: state.features.sandbox ? state.features.sandboxTimeout : undefined,
      sessionScope: state.features.sessionScope,
    },
    tags: state.routingTags.length > 0 ? state.routingTags : undefined,
  };
}
