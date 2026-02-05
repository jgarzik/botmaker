export interface ProviderKey {
  id: string;
  vendor: string;
  secret_encrypted: Buffer;
  label: string | null;
  tag: string | null;
  created_at: number;
}

export interface Bot {
  id: string;
  hostname: string;
  token_hash: string;
  tags: string | null; // JSON array stored as string
  created_at: number;
}

export interface UsageLog {
  id: number;
  bot_id: string;
  vendor: string;
  key_id: string | null;
  status_code: number | null;
  created_at: number;
}

export interface VendorConfig {
  host: string;
  basePath: string;
  authHeader: string;
  authFormat: (key: string) => string;
}

export const VENDOR_CONFIGS: Record<string, VendorConfig> = {
  openai: {
    host: 'api.openai.com',
    basePath: '/v1',
    authHeader: 'Authorization',
    authFormat: (key) => `Bearer ${key}`,
  },
  anthropic: {
    host: 'api.anthropic.com',
    basePath: '', // OpenClaw's anthropic-messages API includes /v1 in its path
    authHeader: 'x-api-key',
    authFormat: (key) => key,
  },
  venice: {
    host: 'api.venice.ai',
    basePath: '/api/v1',
    authHeader: 'Authorization',
    authFormat: (key) => `Bearer ${key}`,
  },
  google: {
    host: 'generativelanguage.googleapis.com',
    basePath: '/v1beta',
    authHeader: 'x-goog-api-key',
    authFormat: (key) => key,
  },
  openrouter: {
    host: 'openrouter.ai',
    basePath: '/api/v1',
    authHeader: 'Authorization',
    authFormat: (key) => `Bearer ${key}`,
  },
};
