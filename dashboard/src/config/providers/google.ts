import type { ProviderConfig } from './types';

export const google: ProviderConfig = {
  id: 'google',
  label: 'Google',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  keyHint: 'AIza...',
  defaultModel: 'gemini-3-pro-preview',
  models: [
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
};
