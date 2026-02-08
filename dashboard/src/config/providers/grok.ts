import type { ProviderConfig } from './types';

export const grok: ProviderConfig = {
  id: 'grok',
  label: 'Grok (xAI)',
  baseUrl: 'https://api.x.ai/v1',
  defaultModel: 'grok-4-1-fast',
  models: [
    { id: 'grok-4', label: 'Grok 4' },
    { id: 'grok-4-heavy', label: 'Grok 4 Heavy' },
    { id: 'grok-4-1-fast', label: 'Grok 4.1 Fast' },
    { id: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast Reasoning' },
    { id: 'grok-3', label: 'Grok 3' },
    { id: 'grok-3-mini', label: 'Grok 3 Mini' },
  ],
};
