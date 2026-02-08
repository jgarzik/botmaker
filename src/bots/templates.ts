/**
 * Bot Templates
 *
 * Generate configuration files for OpenClaw bot workspaces.
 */

import { mkdirSync, writeFileSync, chmodSync, chownSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { validateHostname } from '../secrets/manager.js';

/**
 * Try to change file ownership, but gracefully skip if not permitted.
 * chown requires root privileges; in CI/dev environments we may not have them.
 */
function tryChown(path: string, uid: number, gid: number): void {
  try {
    chownSync(path, uid, gid);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') {
      // Not running as root - skip chown (acceptable in dev/CI)
      return;
    }
    throw err;
  }
}

export interface BotPersona {
  name: string;
  identity: string;
  description: string;
}

export interface ChannelConfig {
  type: 'telegram' | 'discord';
  token: string;
}

export interface ProxyConfig {
  baseUrl: string;
  token: string;
}

export interface BotWorkspaceConfig {
  botId: string;
  botHostname: string;
  botName: string;
  aiProvider: string;
  model: string;
  channel: ChannelConfig;
  persona: BotPersona;
  port: number;
  proxy?: ProxyConfig;
}

/**
 * Map AI provider to OpenClaw API type.
 * Each provider uses a different API format that OpenClaw must know about.
 */
export function getApiTypeForProvider(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'anthropic-messages';
    case 'google':
      return 'google-gemini';
    case 'venice':
    case 'openrouter':
    case 'ollama':
    case 'grok':
    case 'deepseek':
    case 'mistral':
    case 'groq':
    case 'cerebras':
    case 'fireworks':
    case 'togetherai':
    case 'deepinfra':
    case 'perplexity':
    case 'nvidia':
    case 'minimax':
    case 'moonshot':
    case 'scaleway':
    case 'nebius':
    case 'ovhcloud':
    case 'huggingface':
      return 'openai-completions'; // OpenAI-compatible APIs
    case 'openai':
    default:
      return 'openai-responses';
  }
}

/**
 * Generate openclaw.json configuration.
 * Follows OpenClaw's expected config structure for gateway mode.
 * When proxy is configured, uses proxy baseUrl instead of direct API access.
 */
function generateOpenclawConfig(config: BotWorkspaceConfig): object {
  // Format model as provider/model (e.g., "openai/gpt-4o")
  // When using proxy, use custom provider name to avoid merging with built-in defaults
  // that have hardcoded baseUrl values
  let modelSpec: string;
  let modelsConfig: object | undefined;

  if (config.proxy) {
    // Proxy provider: uses proxy baseUrl and token
    const providerName = `${config.aiProvider}-proxy`;
    modelSpec = `${providerName}/${config.model}`;
    modelsConfig = {
      providers: {
        [providerName]: {
          baseUrl: config.proxy.baseUrl,
          apiKey: config.proxy.token,
          api: getApiTypeForProvider(config.aiProvider),
          models: [{ id: config.model, name: config.model }],
        },
      },
    };
  } else {
    // Built-in provider (no custom config)
    modelSpec = `${config.aiProvider}/${config.model}`;
    modelsConfig = undefined;
  }

  return {
    gateway: {
      mode: 'local',
      port: config.port,
      bind: 'lan',
      auth: {
        mode: 'token',
      },
      controlUi: {
        allowInsecureAuth: true,
      },
    },
    channels: {
      [config.channel.type]: {
        enabled: true,
      },
    },
    agents: {
      defaults: {
        model: {
          primary: modelSpec,
        },
        workspace: '/app/botdata/workspace',
      },
    },
    ...(modelsConfig && { models: modelsConfig }),
  };
}

/**
 * Generate SOUL.md - persona identity.
 * Kept minimal so OpenClaw's own template provides the structural guidance.
 * BotMaker writes this before first gateway start; OpenClaw won't overwrite
 * because ensureAgentWorkspace() uses writeFileIfMissing (wx flag).
 */
function generateSoulMd(persona: BotPersona): string {
  return `# SOUL.md - Who You Are

## Persona

${persona.identity}

${persona.description}
`;
}

/**
 * Generate IDENTITY.md - name and presentation.
 * Uses OpenClaw's expected format. BotMaker writes this before first gateway
 * start; OpenClaw won't overwrite (wx flag).
 */
function generateIdentityMd(persona: BotPersona): string {
  return `# IDENTITY.md - Who Am I?

- **Name:** ${persona.name}
- **Creature:** AI assistant
- **Vibe:** ${persona.identity}
- **Emoji:** (pick one that feels right)
- **Avatar:** (none configured)
`;
}

/**
 * Create a complete bot workspace directory structure.
 *
 * OpenClaw expects:
 * - openclaw.json at root of OPENCLAW_STATE_DIR
 * - workspace/ subdirectory with SOUL.md, IDENTITY.md, AGENTS.md
 *
 * @param dataDir - Root data directory
 * @param config - Bot workspace configuration
 */
export function createBotWorkspace(dataDir: string, config: BotWorkspaceConfig): void {
  const botDir = join(dataDir, 'bots', config.botHostname);
  const workspaceDir = join(botDir, 'workspace');

  // OpenClaw runs as uid 1000 (node user), so we need to set ownership
  const OPENCLAW_UID = 1000;
  const OPENCLAW_GID = 1000;

  mkdirSync(botDir, { recursive: true, mode: 0o755 });
  mkdirSync(workspaceDir, { recursive: true, mode: 0o755 });
  chmodSync(botDir, 0o755);
  chmodSync(workspaceDir, 0o755);
  tryChown(botDir, OPENCLAW_UID, OPENCLAW_GID);
  tryChown(workspaceDir, OPENCLAW_UID, OPENCLAW_GID);

  const openclawConfig = generateOpenclawConfig(config);
  const configPath = join(botDir, 'openclaw.json');
  writeFileSync(configPath, JSON.stringify(openclawConfig, null, 2));
  chmodSync(configPath, 0o644);
  tryChown(configPath, OPENCLAW_UID, OPENCLAW_GID);

  const soulPath = join(workspaceDir, 'SOUL.md');
  const identityPath = join(workspaceDir, 'IDENTITY.md');
  writeFileSync(soulPath, generateSoulMd(config.persona));
  writeFileSync(identityPath, generateIdentityMd(config.persona));
  chmodSync(soulPath, 0o644);
  chmodSync(identityPath, 0o644);
  tryChown(soulPath, OPENCLAW_UID, OPENCLAW_GID);
  tryChown(identityPath, OPENCLAW_UID, OPENCLAW_GID);

  const agentDir = join(botDir, 'agents', 'main', 'agent');
  mkdirSync(agentDir, { recursive: true, mode: 0o755 });
  chmodSync(agentDir, 0o755);
  tryChown(agentDir, OPENCLAW_UID, OPENCLAW_GID);

  const sessionsDir = join(botDir, 'agents', 'main', 'sessions');
  mkdirSync(sessionsDir, { recursive: true, mode: 0o755 });
  chmodSync(sessionsDir, 0o755);
  tryChown(sessionsDir, OPENCLAW_UID, OPENCLAW_GID);

  const sandboxDir = join(botDir, 'sandbox');
  mkdirSync(sandboxDir, { recursive: true, mode: 0o755 });
  chmodSync(sandboxDir, 0o755);
  tryChown(sandboxDir, OPENCLAW_UID, OPENCLAW_GID);
}

/**
 * Get the path to a bot's workspace directory.
 *
 * @param dataDir - Root data directory
 * @param hostname - Bot hostname
 * @returns Path to bot workspace
 */
export function getBotWorkspacePath(dataDir: string, hostname: string): string {
  return join(dataDir, 'bots', hostname);
}

/**
 * Delete a bot's workspace directory.
 * Safe to call even if the directory doesn't exist.
 *
 * @param dataDir - Root data directory
 * @param hostname - Bot hostname
 */
export function deleteBotWorkspace(dataDir: string, hostname: string): void {
  validateHostname(hostname);
  const botDir = join(dataDir, 'bots', hostname);
  rmSync(botDir, { recursive: true, force: true });
}
