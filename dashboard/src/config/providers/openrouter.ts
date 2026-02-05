import type { ProviderConfig } from './types';

export const openrouter: ProviderConfig = {
  id: 'openrouter',
  label: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  keyHint: 'sk-or-...',
  defaultModel: 'anthropic/claude-sonnet-4-5',
  models: [
    { id: 'openrouter/auto', label: 'Auto (best for task)' },
    { id: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
    { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'openai/gpt-5.2', label: 'GPT-5.2' },
    { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
  ],
};
