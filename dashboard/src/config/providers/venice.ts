import type { ProviderConfig } from './types';

export const venice: ProviderConfig = {
  id: 'venice',
  label: 'Venice',
  baseUrl: 'https://api.venice.ai/api/v1',
  keyHint: 'VENICE-INFERENCE-KEY-...',
  defaultModel: 'llama-3.3-70b',
  models: [
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    { id: 'venice-uncensored', label: 'Venice Uncensored' },
    { id: 'qwen3-235b-a22b-thinking-2507', label: 'Qwen3 235B Thinking' },
    { id: 'deepseek-v3.2', label: 'DeepSeek V3.2' },
    { id: 'zai-org-glm-4.7', label: 'ZAI GLM 4.7' },
    { id: 'mistral-31-24b', label: 'Mistral 31 24B' },
    { id: 'kimi-k2-5', label: 'Kimi K2.5' },
  ],
};
