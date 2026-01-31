/**
 * Fastify Server
 *
 * API routes for bot management.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { getConfig } from './config.js';
import { initDb } from './db/index.js';
import {
  createBot,
  getBot,
  getBotByName,
  listBots,
  updateBot,
  deleteBot,
  getNextBotPort,
} from './bots/store.js';
import { createBotWorkspace, getBotWorkspacePath, deleteBotWorkspace } from './bots/templates.js';
import { writeSecret, deleteBotSecrets } from './secrets/manager.js';
import { DockerService } from './services/DockerService.js';
import { ReconciliationService } from './services/ReconciliationService.js';
import { ContainerError } from './services/docker-errors.js';
import type { BotStatus } from './types/bot.js';

const docker = new DockerService();

interface CreateBotBody {
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

/**
 * Resolve host paths for Docker bind mounts.
 * If volume names are configured, inspect them to get actual host paths.
 * Otherwise, fall back to using the configured directories directly.
 */
async function resolveHostPaths(config: ReturnType<typeof getConfig>): Promise<{
  hostDataDir: string;
  hostSecretsDir: string;
}> {
  let hostDataDir = resolve(config.dataDir);
  let hostSecretsDir = resolve(config.secretsDir);

  if (config.dataVolumeName) {
    hostDataDir = await docker.getVolumeMountpoint(config.dataVolumeName);
  }
  if (config.secretsVolumeName) {
    hostSecretsDir = await docker.getVolumeMountpoint(config.secretsVolumeName);
  }

  return { hostDataDir, hostSecretsDir };
}

/**
 * Build and configure the Fastify server.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Resolve host paths for Docker bind mounts (inspect volumes if configured)
  const { hostDataDir, hostSecretsDir } = await resolveHostPaths(config);

  // Initialize database
  initDb(config.dataDir);

  const server = Fastify({
    logger: true,
  });

  // Run startup reconciliation
  const reconciliation = new ReconciliationService(docker, config.dataDir, server.log);
  const report = await reconciliation.reconcileOnStartup();
  server.log.info({ report }, 'Startup reconciliation complete');

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // List all bots
  server.get('/api/bots', async () => {
    const bots = listBots();

    // Enrich with container status
    const enrichedBots = await Promise.all(
      bots.map(async (bot) => {
        const containerStatus = await docker.getContainerStatus(bot.id);
        return {
          ...bot,
          container_status: containerStatus,
        };
      })
    );

    return { bots: enrichedBots };
  });

  // Get single bot
  server.get<{ Params: { id: string } }>('/api/bots/:id', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    const containerStatus = await docker.getContainerStatus(bot.id);

    return {
      ...bot,
      container_status: containerStatus,
    };
  });

  // Create bot
  server.post<{ Body: CreateBotBody }>('/api/bots', async (request, reply) => {
    const body = request.body;

    // Validate required fields
    if (!body.name || !body.ai_provider || !body.model || !body.channel_type) {
      reply.code(400);
      return { error: 'Missing required fields: name, ai_provider, model, channel_type' };
    }

    if (!body.channel_token || !body.api_key) {
      reply.code(400);
      return { error: 'Missing required secrets: channel_token, api_key' };
    }

    if (!body.persona?.name || !body.persona?.identity || !body.persona?.description) {
      reply.code(400);
      return { error: 'Missing persona fields: name, identity, description' };
    }

    // Check for duplicate name
    if (getBotByName(body.name)) {
      reply.code(409);
      return { error: 'Bot with this name already exists' };
    }

    // Get next available port before creating bot record
    const port = getNextBotPort(config.botPortStart);

    // Generate gateway token for OpenClaw authentication
    const gatewayToken = randomBytes(32).toString('hex');

    // Create bot record with port and gateway token
    const bot = createBot({
      name: body.name,
      ai_provider: body.ai_provider,
      model: body.model,
      channel_type: body.channel_type,
      port,
      gateway_token: gatewayToken,
    });

    try {
      // Store secrets
      writeSecret(bot.id, 'AI_API_KEY', body.api_key);

      if (body.channel_type === 'telegram') {
        writeSecret(bot.id, 'TELEGRAM_TOKEN', body.channel_token);
      } else if (body.channel_type === 'discord') {
        writeSecret(bot.id, 'DISCORD_TOKEN', body.channel_token);
      }

      // Create workspace
      createBotWorkspace(config.dataDir, {
        botId: bot.id,
        botName: body.name,
        aiProvider: body.ai_provider,
        apiKey: body.api_key,
        model: body.model,
        channel: {
          type: body.channel_type,
          token: body.channel_token,
        },
        persona: body.persona,
        port,
      });

      // Create container
      // Use host paths for Docker bind mounts (Docker daemon runs on host, not in container)
      const hostWorkspacePath = join(hostDataDir, 'bots', bot.id);
      const hostSecretsPath = join(hostSecretsDir, bot.id);
      // Build environment variables including channel-specific tokens
      const environment = [
        `BOT_ID=${bot.id}`,
        `BOT_NAME=${body.name}`,
        `AI_PROVIDER=${body.ai_provider}`,
        `AI_MODEL=${body.model}`,
        `PORT=${port}`,
      ];

      // Add channel token as environment variable (OpenClaw reads these)
      if (body.channel_type === 'telegram') {
        environment.push(`TELEGRAM_BOT_TOKEN=${body.channel_token}`);
      } else if (body.channel_type === 'discord') {
        environment.push(`DISCORD_TOKEN=${body.channel_token}`);
      }

      const containerId = await docker.createContainer(bot.id, {
        image: config.openclawImage,
        environment,
        port,
        hostWorkspacePath,
        hostSecretsPath,
        gatewayToken,
      });

      // Update bot with container ID
      updateBot(bot.id, { container_id: containerId });

      // Start container
      await docker.startContainer(bot.id);
      updateBot(bot.id, { status: 'running' });

      const updatedBot = getBot(bot.id);
      reply.code(201);
      return updatedBot;
    } catch (err) {
      // Cleanup on failure - remove all resources
      try { await docker.removeContainer(bot.id); } catch {}
      deleteBotWorkspace(config.dataDir, bot.id);
      deleteBotSecrets(bot.id);
      deleteBot(bot.id);

      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Container error: ${err.message}` };
      }

      throw err;
    }
  });

  // Delete bot
  server.delete<{ Params: { id: string } }>('/api/bots/:id', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      // Remove container if exists
      await docker.removeContainer(bot.id);
    } catch (err) {
      if (err instanceof ContainerError && err.code !== 'NOT_FOUND') {
        reply.code(500);
        return { error: `Failed to remove container: ${err.message}` };
      }
    }

    // Delete workspace directory
    deleteBotWorkspace(config.dataDir, bot.id);

    // Delete secrets
    deleteBotSecrets(bot.id);

    // Delete bot record
    deleteBot(bot.id);

    return { success: true };
  });

  // Start bot
  server.post<{ Params: { id: string } }>('/api/bots/:id/start', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.startContainer(bot.id);
      updateBot(bot.id, { status: 'running' });

      return { success: true, status: 'running' };
    } catch (err) {
      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Failed to start container: ${err.message}` };
      }
      throw err;
    }
  });

  // Stop bot
  server.post<{ Params: { id: string } }>('/api/bots/:id/stop', async (request, reply) => {
    const bot = getBot(request.params.id);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.stopContainer(bot.id);
      updateBot(bot.id, { status: 'stopped' });

      return { success: true, status: 'stopped' };
    } catch (err) {
      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Failed to stop container: ${err.message}` };
      }
      throw err;
    }
  });

  // Admin cleanup endpoint - removes orphaned containers, workspaces, and secrets
  server.post('/api/admin/cleanup', async () => {
    const cleanupReport = await reconciliation.cleanupOrphans();
    return { success: true, ...cleanupReport };
  });

  // Get orphan preview - shows what would be cleaned up without actually cleaning
  server.get('/api/admin/orphans', async () => {
    const report = await reconciliation.reconcileOnStartup();
    return {
      orphanedContainers: report.orphanedContainers,
      orphanedWorkspaces: report.orphanedWorkspaces,
      orphanedSecrets: report.orphanedSecrets,
      total: report.orphanedContainers.length + report.orphanedWorkspaces.length + report.orphanedSecrets.length,
    };
  });

  // Get container stats for all running bots
  server.get('/api/stats', async () => {
    const stats = await docker.getAllContainerStats();
    return { stats };
  });

  // Serve static dashboard files (if built)
  const dashboardDist = join(process.cwd(), 'dashboard', 'dist');
  if (existsSync(dashboardDist)) {
    await server.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
    });

    // SPA fallback - serve index.html for all non-API routes
    server.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api/') && !request.url.startsWith('/health')) {
        return reply.sendFile('index.html');
      }
      reply.code(404);
      return { error: 'Not found' };
    });
  }

  return server;
}
