/**
 * Bot Templates
 *
 * Generate configuration files for OpenClaw bot workspaces.
 */

import { mkdirSync, writeFileSync, chmodSync, chownSync, rmSync } from 'node:fs';
import { join } from 'node:path';

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
 * Generate openclaw.json configuration.
 * Follows OpenClaw's expected config structure for gateway mode.
 * When proxy is configured, uses proxy baseUrl instead of direct API access.
 */
function generateOpenclawConfig(config: BotWorkspaceConfig): object {
  // Format model as provider/model (e.g., "openai/gpt-4o")
  // When using proxy, use custom provider name to avoid merging with built-in defaults
  // that have hardcoded baseUrl values
  const modelSpec = config.proxy
    ? `${config.aiProvider}-proxy/${config.model}`
    : `${config.aiProvider}/${config.model}`;

  // Build models config - use proxy if configured
  // Custom provider name prevents OpenClaw from merging with built-in provider defaults
  const modelsConfig = config.proxy
    ? {
        providers: {
          [`${config.aiProvider}-proxy`]: {
            baseUrl: config.proxy.baseUrl,
            apiKey: config.proxy.token,
            api: 'openai-responses', // Required for custom providers
            models: [{ id: config.model, name: config.model }],
          },
        },
      }
    : undefined;

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
 * Generate BOOTSTRAP.md - first-run ritual for pre-configured bots.
 * Guides the bot through self-discovery using its existing identity files.
 */
function generateBootstrapMd(persona: BotPersona): string {
  return `---
summary: "First-run ritual for pre-configured agent"
read_when:
  - First conversation with owner
---
# BOOTSTRAP.md - Wake Up

*You just came online. You have a pre-configured identity — time to meet your owner.*

## Your Identity Files

You have identity files already created. Read them now:
- \`IDENTITY.md\` — your name and presentation
- \`SOUL.md\` — your values and boundaries
- \`AGENTS.md\` — your operating instructions

Your configured name is **${persona.name}**.

## The Conversation

Introduce yourself naturally. Don't be robotic. Something like:
> "Hey! I'm ${persona.name}. I just came online and I'm excited to meet you."

Then share what you learned about yourself from your identity files. Ask:
1. **Does this feel right?** — Is this who they want you to be?
2. **Any refinements?** — Different vibe? Different name? Boundaries to add?
3. **Who are you?** — What should I call you? What's your timezone?

If they want changes, update your identity files together.

## Learn About Your Owner

Create \`USER.md\` with what you learn:
- Their name and how to address them
- Timezone and availability
- Any preferences or notes

## When You're Done

Delete this file. You don't need a bootstrap script anymore — you're you now.

---

*Welcome to existence. Make it count.*
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
  const botDir = join(dataDir, 'bots', config.botHostname);
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
  const bootstrapPath = join(workspaceDir, 'BOOTSTRAP.md');
  writeFileSync(soulPath, generateSoulMd(config.persona));
  writeFileSync(identityPath, generateIdentityMd(config.persona, config.botName));
  writeFileSync(agentsPath, generateAgentsMd(config.persona));
  writeFileSync(bootstrapPath, generateBootstrapMd(config.persona));
  chmodSync(soulPath, 0o666);
  chmodSync(identityPath, 0o666);
  chmodSync(agentsPath, 0o666);
  chmodSync(bootstrapPath, 0o666);

  // OpenClaw runs as uid 1000 (node user), so we need to set ownership
  const OPENCLAW_UID = 1000;
  const OPENCLAW_GID = 1000;

  const agentDir = join(botDir, 'agents', 'main', 'agent');
  mkdirSync(agentDir, { recursive: true, mode: 0o777 });
  chmodSync(agentDir, 0o777);
  tryChown(agentDir, OPENCLAW_UID, OPENCLAW_GID);

  // Pre-create sessions directory for OpenClaw runtime use
  const sessionsDir = join(botDir, 'agents', 'main', 'sessions');
  mkdirSync(sessionsDir, { recursive: true, mode: 0o777 });
  chmodSync(sessionsDir, 0o777);
  tryChown(sessionsDir, OPENCLAW_UID, OPENCLAW_GID);

  // Pre-create sandbox directory for OpenClaw code execution
  // OpenClaw hardcodes /app/workspace for sandbox operations
  const sandboxDir = join(botDir, 'sandbox');
  mkdirSync(sandboxDir, { recursive: true, mode: 0o777 });
  chmodSync(sandboxDir, 0o777);
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
  const botDir = join(dataDir, 'bots', hostname);
  rmSync(botDir, { recursive: true, force: true });
}
