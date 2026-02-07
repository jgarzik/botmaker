import type { ProviderConfig, ModelInfo } from './types';
import { openai } from './openai';
import { anthropic } from './anthropic';
import { google } from './google';
import { venice } from './venice';
import { openrouter } from './openrouter';
import { ollama } from './ollama';

export type { ProviderConfig, ModelInfo };

export const PROVIDERS: ProviderConfig[] = [openai, anthropic, google, venice, openrouter, ollama];

export const AI_PROVIDERS = PROVIDERS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export const MODELS: Record<string, string[]> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.models.map((m) => m.id)])
);

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModels(providerId: string): ModelInfo[] {
  return getProvider(providerId)?.models ?? [];
}

export function getDefaultModel(providerId: string): string {
  const provider = getProvider(providerId);
  return provider?.defaultModel ?? provider?.models[0]?.id ?? '';
}

export function getKeyHint(providerId: string): string {
  return getProvider(providerId)?.keyHint ?? 'API key';
}
