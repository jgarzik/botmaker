import type { ProviderConfig } from './types';

export const anthropic: ProviderConfig = {
  id: 'anthropic',
  label: 'Anthropic',
  baseUrl: 'https://api.anthropic.com/v1',
  keyHint: 'sk-ant-...',
  defaultModel: 'claude-opus-4-5',
  models: [
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
};
