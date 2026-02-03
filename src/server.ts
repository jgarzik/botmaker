import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { getConfig } from './config.js';
import { initDb } from './db/index.js';
import {
  createBot,
  getBot,
  getBotByHostname,
  listBots,
  updateBot,
  deleteBot,
  getNextBotPort,
} from './bots/store.js';
import { getDb } from './db/index.js';
import { createBotWorkspace, deleteBotWorkspace } from './bots/templates.js';
import { writeSecret, deleteBotSecrets } from './secrets/manager.js';
import { DockerService } from './services/DockerService.js';
import { ReconciliationService } from './services/ReconciliationService.js';
import { ContainerError } from './services/docker-errors.js';
import {
  getProxyConfig,
  registerBotWithProxy,
  revokeBotFromProxy,
  listProxyKeys,
  addProxyKey,
  deleteProxyKey,
  getProxyHealth,
  type AddKeyInput,
} from './proxy/client.js';

const docker = new DockerService();

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  const equal = timingSafeEqual(aPadded, bPadded);
  return equal && aBuf.length === bBuf.length;
}

// Session management
interface Session {
  token: string;
  expiresAt: number;
}

// Session storage: intentionally in-memory for simplicity.
// Sessions are lost on server restart; users must re-login.
// Expired sessions are cleaned up lazily in validateSession().
// Acceptable for single-user admin dashboard with infrequent restarts.
const sessions = new Map<string, Session>();

function createSession(expiryMs: number): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + expiryMs;
  sessions.set(token, { token, expiresAt });
  return token;
}

function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function invalidateSession(token: string): void {
  sessions.delete(token);
}

// Export for testing
export { sessions, createSession, validateSession, invalidateSession };

type SessionScope = 'user' | 'channel' | 'global';

interface CreateBotBody {
  name: string;
  hostname: string;
  emoji: string;
  avatarUrl?: string;
  providers?: { providerId: string; model: string }[];
  primaryProvider?: string;
  channels?: { channelType: string; token: string }[];
  persona: {
    name: string;
    soulMarkdown: string;
  };
  features: {
    commands: boolean;
    tts: boolean;
    ttsVoice?: string;
    sandbox: boolean;
    sandboxTimeout?: number;
    sessionScope: SessionScope;
  };
  tags?: string[];
}

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

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Resolve host paths for Docker bind mounts (inspect volumes if configured)
  const { hostDataDir, hostSecretsDir } = await resolveHostPaths(config);

  // Initialize database
  initDb(config.dataDir);

  const server = Fastify({
    logger: true,
  });

  // Register security headers
  await server.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // Register rate limiting
  await server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Authentication middleware for API routes
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === '/health') {
      return;
    }
    // Allow login endpoint without auth
    if (request.url === '/api/login' && request.method === 'POST') {
      return;
    }
    if (!request.url.startsWith('/api/')) {
      return;
    }

    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing authorization' });
      return;
    }

    const token = auth.slice(7);
    // Validate session token
    if (!validateSession(token)) {
      reply.code(401).send({ error: 'Invalid or expired session' });
      return;
    }
  });

  // Run startup reconciliation
  const reconciliation = new ReconciliationService(docker, config.dataDir, server.log);
  const report = await reconciliation.reconcileOnStartup();
  server.log.info({ report }, 'Startup reconciliation complete');

  // Health check (rate limiting disabled for monitoring/load balancers)
  server.get('/health', { config: { rateLimit: false } }, () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Login endpoint
  server.post<{ Body: { password?: string } }>('/api/login', async (request, reply) => {
    const { password } = request.body;

    if (!password) {
      reply.code(400);
      return { error: 'Password is required' };
    }

    if (!safeCompare(password, config.adminPassword)) {
      reply.code(401);
      return { error: 'Invalid password' };
    }

    const token = createSession(config.sessionExpiryMs);
    return { token };
  });

  // Logout endpoint
  server.post('/api/logout', async (request, _reply) => {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      invalidateSession(token);
    }
    return { success: true };
  });

  // List all bots
  server.get('/api/bots', async () => {
    const bots = listBots();

    // Enrich with container status
    const enrichedBots = await Promise.all(
      bots.map(async (bot) => {
        const containerStatus = await docker.getContainerStatus(bot.hostname);
        return {
          ...bot,
          container_status: containerStatus,
        };
      })
    );

    return { bots: enrichedBots };
  });

  // Get single bot
  server.get<{ Params: { hostname: string } }>('/api/bots/:hostname', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    const containerStatus = await docker.getContainerStatus(bot.hostname);

    return {
      ...bot,
      container_status: containerStatus,
    };
  });

  // Create bot
  server.post<{ Body: CreateBotBody }>('/api/bots', async (request, reply) => {
    const body = request.body;

    // Validate required fields
    if (!body.name) {
      reply.code(400);
      return { error: 'Missing required field: name' };
    }

    if (!body.hostname) {
      reply.code(400);
      return { error: 'Missing required field: hostname' };
    }

    // Validate hostname format (DNS-compatible, max 64 chars)
    if (!/^[a-z0-9-]{1,64}$/.test(body.hostname)) {
      reply.code(400);
      return { error: 'Hostname must be 1-64 lowercase letters, numbers, and hyphens' };
    }

    if (!body.providers || body.providers.length === 0) {
      reply.code(400);
      return { error: 'At least one provider is required' };
    }

    if (!body.channels || body.channels.length === 0) {
      reply.code(400);
      return { error: 'At least one channel is required' };
    }

    // Check for duplicate hostname
    if (getBotByHostname(body.hostname)) {
      reply.code(409);
      return { error: 'Bot with this hostname already exists' };
    }

    // Use primary provider or first provider
    const primaryProvider = body.providers.find(p => p.providerId === body.primaryProvider) ?? body.providers[0];
    const primaryChannel = body.channels[0];

    // Get next available port
    const port = getNextBotPort(config.botPortStart);
    const gatewayToken = randomBytes(32).toString('hex');

    // Create bot record
    const bot = createBot({
      name: body.name,
      hostname: body.hostname,
      ai_provider: primaryProvider.providerId,
      model: primaryProvider.model,
      channel_type: primaryChannel.channelType as 'telegram' | 'discord',
      port,
      gateway_token: gatewayToken,
      tags: body.tags,
    });

    // Check if proxy is configured
    const proxyConfig = getProxyConfig();
    let proxyToken: string | null = null;

    try {
      // Register with proxy if configured
      if (proxyConfig) {
        const registration = await registerBotWithProxy(proxyConfig, bot.id, bot.hostname, body.tags);
        proxyToken = registration.token;
      }

      for (const channel of body.channels) {
        let tokenName: string;
        if (channel.channelType === 'telegram') {
          tokenName = 'TELEGRAM_TOKEN';
        } else if (channel.channelType === 'discord') {
          tokenName = 'DISCORD_TOKEN';
        } else {
          tokenName = `${channel.channelType.toUpperCase()}_TOKEN`;
        }
        writeSecret(bot.hostname, tokenName, channel.token);
      }

      // Build proxy config for workspace if using proxy
      const workspaceProxyConfig = proxyConfig && proxyToken
        ? {
            baseUrl: `http://keyring-proxy:9101/v1/${primaryProvider.providerId}`,
            token: proxyToken,
          }
        : undefined;

      // Create workspace
      createBotWorkspace(config.dataDir, {
        botId: bot.id,
        botHostname: bot.hostname,
        botName: body.name,
        aiProvider: primaryProvider.providerId,
        model: primaryProvider.model,
        channel: {
          type: primaryChannel.channelType as 'telegram' | 'discord',
          token: primaryChannel.token,
        },
        persona: {
          name: body.persona.name,
          identity: body.persona.soulMarkdown || '',
          description: body.emoji || '',
        },
        port,
        proxy: workspaceProxyConfig,
      });

      // Build environment
      const hostWorkspacePath = join(hostDataDir, 'bots', bot.hostname);
      const hostSecretsPath = join(hostSecretsDir, bot.hostname);
      const hostSandboxPath = join(hostDataDir, 'bots', bot.hostname, 'sandbox');
      const environment = [
        `BOT_ID=${bot.id}`,
        `BOT_NAME=${body.name}`,
        `AI_PROVIDER=${primaryProvider.providerId}`,
        `AI_MODEL=${primaryProvider.model}`,
        `PORT=${port}`,
      ];

      // Add channel tokens
      for (const channel of body.channels) {
        if (channel.channelType === 'telegram') {
          environment.push(`TELEGRAM_BOT_TOKEN=${channel.token}`);
        } else if (channel.channelType === 'discord') {
          environment.push(`DISCORD_TOKEN=${channel.token}`);
        }
      }

      const containerId = await docker.createContainer(bot.hostname, bot.id, {
        image: config.openclawImage,
        environment,
        port,
        hostWorkspacePath,
        hostSecretsPath,
        hostSandboxPath,
        gatewayToken,
        networkName: proxyConfig ? 'bm-internal' : undefined,
      });

      const db = getDb();
      db.transaction(() => {
        updateBot(bot.id, { container_id: containerId });
      })();
      await docker.startContainer(bot.hostname);
      db.transaction(() => {
        updateBot(bot.id, { status: 'running' });
      })();

      const updatedBot = getBot(bot.id);
      reply.code(201);
      return updatedBot;
    } catch (err) {
      try { await docker.removeContainer(bot.hostname); } catch { /* ignore cleanup errors */ }
      if (proxyConfig) {
        try { await revokeBotFromProxy(proxyConfig, bot.id); } catch { /* ignore cleanup errors */ }
      }
      deleteBotWorkspace(config.dataDir, bot.hostname);
      deleteBotSecrets(bot.hostname);
      deleteBot(bot.id);

      if (err instanceof ContainerError) {
        reply.code(500);
        return { error: `Container error: ${err.message}` };
      }
      throw err;
    }
  });

  // Delete bot
  server.delete<{ Params: { hostname: string } }>('/api/bots/:hostname', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      // Remove container if exists
      await docker.removeContainer(bot.hostname);
    } catch (err) {
      if (err instanceof ContainerError && err.code !== 'NOT_FOUND') {
        reply.code(500);
        return { error: `Failed to remove container: ${err.message}` };
      }
    }

    // Revoke from proxy if configured
    const proxyConfig = getProxyConfig();
    if (proxyConfig) {
      try {
        await revokeBotFromProxy(proxyConfig, bot.id);
      } catch {
        // Ignore proxy errors during deletion
      }
    }

    // Delete workspace directory
    deleteBotWorkspace(config.dataDir, bot.hostname);

    // Delete secrets
    deleteBotSecrets(bot.hostname);

    // Delete bot record
    const db = getDb();
    db.transaction(() => {
      deleteBot(bot.id);
    })();

    return { success: true };
  });

  // Start bot
  server.post<{ Params: { hostname: string } }>('/api/bots/:hostname/start', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.startContainer(bot.hostname);
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
  server.post<{ Params: { hostname: string } }>('/api/bots/:hostname/stop', async (request, reply) => {
    const bot = getBotByHostname(request.params.hostname);

    if (!bot) {
      reply.code(404);
      return { error: 'Bot not found' };
    }

    try {
      await docker.stopContainer(bot.hostname);
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

  // Proxy key management endpoints
  server.get('/api/proxy/keys', async (_request, reply) => {
    const proxyConfig = getProxyConfig();
    if (!proxyConfig) {
      reply.code(503);
      return { error: 'Proxy not configured' };
    }

    try {
      const keys = await listProxyKeys(proxyConfig);
      return { keys };
    } catch (err) {
      reply.code(502);
      return { error: err instanceof Error ? err.message : 'Failed to list proxy keys' };
    }
  });

  server.post<{ Body: AddKeyInput }>('/api/proxy/keys', async (request, reply) => {
    const proxyConfig = getProxyConfig();
    if (!proxyConfig) {
      reply.code(503);
      return { error: 'Proxy not configured' };
    }

    const body = request.body;
    if (!body.vendor || !body.secret) {
      reply.code(400);
      return { error: 'Missing vendor or secret' };
    }

    try {
      const result = await addProxyKey(proxyConfig, body);
      reply.code(201);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: err instanceof Error ? err.message : 'Failed to add proxy key' };
    }
  });

  server.delete<{ Params: { id: string } }>('/api/proxy/keys/:id', async (request, reply) => {
    const proxyConfig = getProxyConfig();
    if (!proxyConfig) {
      reply.code(503);
      return { error: 'Proxy not configured' };
    }

    try {
      await deleteProxyKey(proxyConfig, request.params.id);
      return { ok: true };
    } catch (err) {
      reply.code(502);
      return { error: err instanceof Error ? err.message : 'Failed to delete proxy key' };
    }
  });

  server.get('/api/proxy/health', async (_request, reply) => {
    const proxyConfig = getProxyConfig();
    if (!proxyConfig) {
      reply.code(503);
      return { error: 'Proxy not configured', configured: false };
    }

    try {
      const health = await getProxyHealth(proxyConfig);
      return { ...health, configured: true };
    } catch (err) {
      reply.code(502);
      return { error: err instanceof Error ? err.message : 'Failed to get proxy health', configured: true };
    }
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
