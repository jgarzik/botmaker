export type BotStatus = 'created' | 'running' | 'stopped' | 'error';

export interface ContainerStatus {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
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

export interface CreateBotInput {
  name: string;
  ai_provider: string;
  model: string;
  channel_type: 'telegram' | 'discord';
  channel_token: string;
  api_key: string;
  persona: {
    name: string;
    identity: string;
    description: string;
  };
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
  apiKey: string;
  model: string;
}

export interface ChannelConfigInput {
  channelType: string;
  token: string;
}

export interface CreateBotInputExtended {
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
}
