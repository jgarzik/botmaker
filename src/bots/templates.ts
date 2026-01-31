/**
 * Bot Templates
 *
 * Generate configuration files for OpenClaw bot workspaces.
 */

import { mkdirSync, writeFileSync, chmodSync, chownSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export interface BotPersona {
  name: string;
  identity: string;
  description: string;
}

export interface ChannelConfig {
  type: 'telegram' | 'discord';
  token: string;
}

export interface BotWorkspaceConfig {
  botId: string;
  botName: string;
  aiProvider: string;
  apiKey: string;
  model: string;
  channel: ChannelConfig;
  persona: BotPersona;
  port: number;
}

/**
 * Generate auth-profiles.json for OpenClaw API authentication.
 * OpenClaw reads this from agents/main/agent/auth-profiles.json.
 */
function generateAuthProfiles(provider: string, apiKey: string): object {
  return {
    version: 1,
    profiles: {
      [`${provider}:default`]: {
        type: 'api_key',
        provider: provider,
        key: apiKey,
      },
    },
  };
}

/**
 * Generate openclaw.json configuration.
 * Follows OpenClaw's expected config structure for gateway mode.
 */
function generateOpenclawConfig(config: BotWorkspaceConfig): object {
  // Format model as provider/model (e.g., "openai/gpt-4o")
  const modelSpec = `${config.aiProvider}/${config.model}`;

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
      },
    },
  };
}

/**
 * Generate SOUL.md - persona and boundaries.
 */
function generateSoulMd(persona: BotPersona): string {
  return `# Soul

## Core Identity
${persona.identity}

## Description
${persona.description}

## Boundaries
- Be helpful and constructive
- Stay in character as ${persona.name}
- Do not share harmful or dangerous information
- Respect user privacy
`;
}

/**
 * Generate IDENTITY.md - name and presentation.
 */
function generateIdentityMd(persona: BotPersona, botName: string): string {
  return `# Identity

## Name
${persona.name}

## Bot Name
${botName}

## Presentation
${persona.identity}

## Avatar
(No avatar configured)
`;
}

/**
 * Generate AGENTS.md - operating instructions.
 */
function generateAgentsMd(persona: BotPersona): string {
  return `# Agents

## Primary Agent
Name: ${persona.name}

### Instructions
${persona.description}

### Capabilities
- Respond to user messages
- Maintain conversation context
- Follow persona guidelines

### Limitations
- Cannot access external systems
- Cannot execute code
- Cannot access user data beyond conversation
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
  const botDir = join(dataDir, 'bots', config.botId);
  const workspaceDir = join(botDir, 'workspace');

  // Create directories with permissions for bot container (runs as uid 1000)
  mkdirSync(botDir, { recursive: true, mode: 0o777 });
  mkdirSync(workspaceDir, { recursive: true, mode: 0o777 });
  // Ensure parent dir has correct permissions (recursive: true doesn't set mode on existing dirs)
  chmodSync(botDir, 0o777);
  chmodSync(workspaceDir, 0o777);

  // Write openclaw.json at root of bot directory (OPENCLAW_STATE_DIR)
  const openclawConfig = generateOpenclawConfig(config);
  const configPath = join(botDir, 'openclaw.json');
  writeFileSync(configPath, JSON.stringify(openclawConfig, null, 2));
  chmodSync(configPath, 0o666);

  // Write workspace files
  const soulPath = join(workspaceDir, 'SOUL.md');
  const identityPath = join(workspaceDir, 'IDENTITY.md');
  const agentsPath = join(workspaceDir, 'AGENTS.md');
  writeFileSync(soulPath, generateSoulMd(config.persona));
  writeFileSync(identityPath, generateIdentityMd(config.persona, config.botName));
  writeFileSync(agentsPath, generateAgentsMd(config.persona));
  chmodSync(soulPath, 0o666);
  chmodSync(identityPath, 0o666);
  chmodSync(agentsPath, 0o666);

  // Create auth-profiles.json for OpenClaw API authentication
  // OpenClaw runs as uid 1000 (node user), so we need to set ownership
  const OPENCLAW_UID = 1000;
  const OPENCLAW_GID = 1000;

  const agentDir = join(botDir, 'agents', 'main', 'agent');
  mkdirSync(agentDir, { recursive: true, mode: 0o777 });
  chmodSync(agentDir, 0o777);
  chownSync(agentDir, OPENCLAW_UID, OPENCLAW_GID);

  const authProfilesPath = join(agentDir, 'auth-profiles.json');
  const authProfiles = generateAuthProfiles(config.aiProvider, config.apiKey);
  writeFileSync(authProfilesPath, JSON.stringify(authProfiles, null, 2));
  chmodSync(authProfilesPath, 0o666);
  chownSync(authProfilesPath, OPENCLAW_UID, OPENCLAW_GID);

  // Pre-create sessions directory for OpenClaw runtime use
  const sessionsDir = join(botDir, 'agents', 'main', 'sessions');
  mkdirSync(sessionsDir, { recursive: true, mode: 0o777 });
  chmodSync(sessionsDir, 0o777);
  chownSync(sessionsDir, OPENCLAW_UID, OPENCLAW_GID);
}

/**
 * Get the path to a bot's workspace directory.
 *
 * @param dataDir - Root data directory
 * @param botId - Bot UUID
 * @returns Path to bot workspace
 */
export function getBotWorkspacePath(dataDir: string, botId: string): string {
  return join(dataDir, 'bots', botId);
}

/**
 * Delete a bot's workspace directory.
 * Safe to call even if the directory doesn't exist.
 *
 * @param dataDir - Root data directory
 * @param botId - Bot UUID
 */
export function deleteBotWorkspace(dataDir: string, botId: string): void {
  const botDir = join(dataDir, 'bots', botId);
  rmSync(botDir, { recursive: true, force: true });
}
