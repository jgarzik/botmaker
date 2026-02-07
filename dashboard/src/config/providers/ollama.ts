import type { ProviderConfig } from './types';

export const ollama: ProviderConfig = {
  id: 'ollama',
  label: 'Ollama',
  baseUrl: 'http://host.docker.internal:4001/v1',
  keyHint: 'superproxy master API key',
  defaultModel: '',
  models: [],
  dynamicModels: true,
  baseUrlEditable: true,
};
