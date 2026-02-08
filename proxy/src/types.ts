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
  port?: number;          // default: 443
  protocol?: 'http' | 'https'; // default: 'https'
  noAuth?: boolean;            // Skip API key injection (e.g., local Ollama)
  forceNonStreaming?: boolean;  // Strip stream:true, convert response to SSE
}

const VENDOR_CONFIGS: Record<string, VendorConfig> = {
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
  grok: {
    host: 'api.x.ai',
    basePath: '/v1',
    authHeader: 'Authorization',
    authFormat: (key) => `Bearer ${key}`,
  },
};

export { VENDOR_CONFIGS };

export function initOllamaVendor(upstream: string): void {
  const url = new URL(upstream);
  VENDOR_CONFIGS.ollama = {
    host: url.hostname,
    port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    basePath: '/v1',
    authHeader: 'Authorization',
    authFormat: () => '',
    noAuth: true,
    forceNonStreaming: true,
  };
}
