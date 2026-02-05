import type { ProviderConfig } from './types';

export const openai: ProviderConfig = {
  id: 'openai',
  label: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  keyHint: 'sk-...',
  defaultModel: 'gpt-5.2',
  models: [
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'o3', label: 'o3' },
    { id: 'o4-mini', label: 'o4 Mini' },
  ],
};
