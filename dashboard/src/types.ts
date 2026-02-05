export type BotStatus = 'created' | 'starting' | 'running' | 'stopped' | 'error';

export type HealthStatus = 'none' | 'starting' | 'healthy' | 'unhealthy';

export interface ContainerStatus {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  health: HealthStatus;
}

export interface Bot {
  id: string;
  name: string;
  hostname: string;
  ai_provider: string;
  model: string;
  channel_type: string;
  container_id: string | null;
  port: number | null;
  gateway_token: string | null;
  status: BotStatus;
  created_at: string;
  updated_at: string;
  container_status?: ContainerStatus | null;
}

export interface ContainerStats {
  hostname: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: string;
}

export interface OrphanReport {
  orphanedContainers: string[];
  orphanedWorkspaces: string[];
  orphanedSecrets: string[];
  total: number;
}

export interface CleanupReport {
  success: boolean;
  containersRemoved: number;
  workspacesRemoved: number;
  secretsRemoved: number;
}

export type SessionScope = 'user' | 'channel' | 'global';

export interface WizardFeatures {
  commands: boolean;
  tts: boolean;
  ttsVoice?: string;
  sandbox: boolean;
  sandboxTimeout?: number;
  sessionScope: SessionScope;
}

export interface ProviderConfigInput {
  providerId: string;
  model: string;
}

export interface ChannelConfigInput {
  channelType: string;
  token: string;
}

export interface CreateBotInput {
  name: string;
  hostname: string;
  emoji: string;
  avatarUrl?: string;
  providers: ProviderConfigInput[];
  primaryProvider: string;
  channels: ChannelConfigInput[];
  persona: {
    name: string;
    soulMarkdown: string;
  };
  features: WizardFeatures;
  tags?: string[];
}

// Proxy key types
export interface ProxyKey {
  id: string;
  vendor: string;
  label: string | null;
  tag: string | null;
  created_at: number;
}

export interface AddKeyInput {
  vendor: string;
  secret: string;
  label?: string;
  tag?: string;
}

export interface ProxyHealthResponse {
  status?: string;
  keyCount?: number;
  botCount?: number;
  configured: boolean;
  error?: string;
}
