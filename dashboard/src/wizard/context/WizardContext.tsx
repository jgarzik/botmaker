import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { SessionScope, CreateBotInputExtended } from '../../types';
import { getTemplate } from '../data/templates';
import { getDefaultModel } from '../../config/providers';

export interface WizardState {
  selectedTemplateId: string | null;
  botName: string;
  emoji: string;
  avatarFile: File | null;
  avatarPreviewUrl: string;
  soulMarkdown: string;
  enabledProviders: string[];
  enabledChannels: string[];
  features: {
    commands: boolean;
    tts: boolean;
    ttsVoice: string;
    sandbox: boolean;
    sandboxTimeout: number;
    sessionScope: SessionScope;
  };
  providerConfigs: Record<string, { apiKey: string; model: string }>;
  channelConfigs: Record<string, { token: string }>;
}

type WizardAction =
  | { type: 'SELECT_TEMPLATE'; templateId: string }
  | { type: 'SET_BOT_NAME'; name: string }
  | { type: 'SET_EMOJI'; emoji: string }
  | { type: 'SET_AVATAR'; file: File | null; previewUrl: string }
  | { type: 'SET_SOUL_MARKDOWN'; markdown: string }
  | { type: 'TOGGLE_PROVIDER'; providerId: string }
  | { type: 'TOGGLE_CHANNEL'; channelId: string }
  | { type: 'SET_FEATURE'; feature: keyof WizardState['features']; value: unknown }
  | { type: 'SET_PROVIDER_CONFIG'; providerId: string; config: { apiKey?: string; model?: string } }
  | { type: 'SET_CHANNEL_CONFIG'; channelId: string; config: { token: string } }
  | { type: 'RESET' };

const initialState: WizardState = {
  selectedTemplateId: null,
  botName: '',
  emoji: '🤖',
  avatarFile: null,
  avatarPreviewUrl: '',
  soulMarkdown: '',
  enabledProviders: [],
  enabledChannels: [],
  features: {
    commands: true,
    tts: false,
    ttsVoice: 'alloy',
    sandbox: false,
    sandboxTimeout: 30,
    sessionScope: 'user',
  },
  providerConfigs: {},
  channelConfigs: {},
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_TEMPLATE': {
      const template = getTemplate(action.templateId);
      if (!template) return state;
      return {
        ...state,
        selectedTemplateId: action.templateId,
        emoji: template.emoji || state.emoji,
        soulMarkdown: template.soulMarkdown,
      };
    }

    case 'SET_BOT_NAME':
      return { ...state, botName: action.name };

    case 'SET_EMOJI':
      return { ...state, emoji: action.emoji };

    case 'SET_AVATAR':
      return {
        ...state,
        avatarFile: action.file,
        avatarPreviewUrl: action.previewUrl,
      };

    case 'SET_SOUL_MARKDOWN':
      return { ...state, soulMarkdown: action.markdown };

    case 'TOGGLE_PROVIDER': {
      const { providerId } = action;
      const enabled = state.enabledProviders.includes(providerId);
      if (enabled) {
        const { [providerId]: _, ...remainingConfigs } = state.providerConfigs;
        return {
          ...state,
          enabledProviders: state.enabledProviders.filter((p) => p !== providerId),
          providerConfigs: remainingConfigs,
        };
      } else {
        return {
          ...state,
          enabledProviders: [...state.enabledProviders, providerId],
          providerConfigs: {
            ...state.providerConfigs,
            [providerId]: { apiKey: '', model: getDefaultModel(providerId) },
          },
        };
      }
    }

    case 'TOGGLE_CHANNEL': {
      const { channelId } = action;
      const enabled = state.enabledChannels.includes(channelId);
      if (enabled) {
        const { [channelId]: _, ...remainingConfigs } = state.channelConfigs;
        return {
          ...state,
          enabledChannels: state.enabledChannels.filter((c) => c !== channelId),
          channelConfigs: remainingConfigs,
        };
      } else {
        return {
          ...state,
          enabledChannels: [...state.enabledChannels, channelId],
          channelConfigs: {
            ...state.channelConfigs,
            [channelId]: { token: '' },
          },
        };
      }
    }

    case 'SET_FEATURE':
      return {
        ...state,
        features: {
          ...state.features,
          [action.feature]: action.value,
        },
      };

    case 'SET_PROVIDER_CONFIG':
      return {
        ...state,
        providerConfigs: {
          ...state.providerConfigs,
          [action.providerId]: {
            ...state.providerConfigs[action.providerId],
            ...action.config,
          },
        },
      };

    case 'SET_CHANNEL_CONFIG':
      return {
        ...state,
        channelConfigs: {
          ...state.channelConfigs,
          [action.channelId]: action.config,
        },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
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
      if (!/^[a-z0-9-]+$/.test(state.botName)) {
        return { valid: false, error: 'Bot name must be lowercase letters, numbers, and hyphens only' };
      }
      if (state.botName.length < 2) {
        return { valid: false, error: 'Bot name must be at least 2 characters' };
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
      for (const providerId of state.enabledProviders) {
        const config = state.providerConfigs[providerId];
        if (!config?.apiKey?.trim()) {
          return { valid: false, error: `API key required for ${providerId}` };
        }
      }
      for (const channelId of state.enabledChannels) {
        const config = state.channelConfigs[channelId];
        if (!config?.token?.trim()) {
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

export function buildCreateBotInput(state: WizardState): CreateBotInputExtended {
  const providers = state.enabledProviders.map((providerId) => ({
    providerId,
    apiKey: state.providerConfigs[providerId]?.apiKey || '',
    model: state.providerConfigs[providerId]?.model || '',
  }));

  const channels = state.enabledChannels.map((channelType) => ({
    channelType,
    token: state.channelConfigs[channelType]?.token || '',
  }));

  return {
    name: state.botName,
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
  };
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  validate: (page: number) => ValidationResult;
  buildInput: () => CreateBotInputExtended;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const validate = useCallback(
    (page: number) => validatePage(page, state),
    [state]
  );

  const buildInput = useCallback(
    () => buildCreateBotInput(state),
    [state]
  );

  return (
    <WizardContext.Provider value={{ state, dispatch, validate, buildInput }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
