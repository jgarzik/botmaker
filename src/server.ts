import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as dns } from 'node:dns';

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

/** Rewrite localhost URLs to host.docker.internal for use inside Docker containers. */
function toDockerHostUrl(url: string): string {
  return url.replace(/\blocalhost\b|127\.0\.0\.1/g, 'host.docker.internal');
}

/** Check if a URL targets a local discovery host (localhost, 127.0.0.1, host.docker.internal). */
function isLocalDiscoveryUrl(urlStr: string): boolean {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'host.docker.internal';
  } catch {
    return false;
  }
}

const VALID_PROVIDER_IDS = new Set([
  'openai', 'anthropic', 'google', 'venice', 'openrouter', 'ollama', 'grok',
  'deepseek', 'mistral', 'groq', 'cerebras', 'fireworks', 'togetherai',
  'deepinfra', 'perplexity', 'nvidia', 'minimax', 'moonshot', 'scaleway',
  'nebius', 'ovhcloud', 'huggingface',
]);

const VALID_CHANNEL_TYPES = new Set([
  'telegram', 'discord', 'slack', 'signal', 'whatsapp', 'matrix', 'nostr',
  'twitter', 'facebook', 'instagram', 'teams', 'line', 'wechat', 'viber',
  'kik', 'twitch', 'reddit', 'mastodon', 'bluesky', 'rocketchat',
  'mattermost', 'zulip', 'irc', 'xmpp', 'sms', 'email', 'googlechat',
  'webex', 'web', 'webhook',
]);

const MODEL_REGEX = /^(?!.*\.\.)[a-zA-Z0-9._:/-]{1,128}$/;

function isPrivateIp(ip: string): boolean {
  // Handle IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1)
  const v4Mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  const normalizedIp = v4Mapped ? v4Mapped[1] : ip;

  if (normalizedIp === '::1') return true;

  const lowerIp = normalizedIp.toLowerCase();
  if (lowerIp.startsWith('fe80:')) return true;
  if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;
  if (lowerIp === '::') return true;
  if (lowerIp.startsWith('2001:db8:')) return true;
  if (lowerIp.startsWith('2001:0:')) return true;
  if (lowerIp.startsWith('100:')) return true;
  if (lowerIp.startsWith('64:ff9b:')) return true;

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalizedIp);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && b >= 18 && b <= 19) return true;
    if (a === 240 || (a === 255 && b === 255 && c === 255 && d === 255)) return true;
  }

  return false;
}

function isPrivateUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return true;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return true;
  }

  return isPrivateIp(hostname);
}

const MAX_RESPONSE_BODY_BYTES = 1024 * 1024; // 1MB

async function readLimitedBody(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) throw new Error('No response body');
  const reader = body.getReader();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    const value = result.value as Uint8Array;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      void reader.cancel();
      throw new Error('Response body exceeds size limit');
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function resolveAndValidateUrl(urlStr: string): Promise<{ resolvedUrl: string; originalHost: string }> {
  const parsed = new URL(urlStr);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // If hostname is already an IP literal, isPrivateUrl already checked it
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    return { resolvedUrl: urlStr, originalHost: hostname };
  }

  const results4 = await dns.resolve4(hostname).catch(() => [] as string[]);
  const results6 = await dns.resolve6(hostname).catch(() => [] as string[]);
  const addresses = [...results4, ...results6];

  if (addresses.length === 0) {
    throw new Error('DNS resolution returned no addresses');
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error('Resolved address is private');
    }
  }

  // All resolved addresses validated as non-private.
  // Preserve original hostname so HTTPS TLS/SNI and cert validation work.
  return { resolvedUrl: urlStr, originalHost: hostname };
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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
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

    if (!/^[a-zA-Z0-9 _.-]{1,128}$/.test(body.name)) {
      reply.code(400);
      return { error: 'Bot name must be 1-128 characters: letters, numbers, spaces, underscores, dots, hyphens' };
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

    for (const provider of body.providers) {
      if (!VALID_PROVIDER_IDS.has(provider.providerId)) {
        reply.code(400);
        return { error: `Invalid provider: ${provider.providerId}` };
      }
      if (!MODEL_REGEX.test(provider.model)) {
        reply.code(400);
        return { error: `Invalid model name: ${provider.model}` };
      }
    }

    for (const channel of body.channels) {
      if (!VALID_CHANNEL_TYPES.has(channel.channelType)) {
        reply.code(400);
        return { error: `Invalid channel type: ${channel.channelType}` };
      }
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

      // Build provider config for workspace
      let workspaceProxyConfig: { baseUrl: string; token: string } | undefined;

      if (proxyConfig && proxyToken) {
        workspaceProxyConfig = {
          baseUrl: `http://keyring-proxy:9101/v1/${primaryProvider.providerId}`,
          token: proxyToken,
        };
      }

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
        updateBot(bot.id, { container_id: containerId, image_version: config.openclawImage });
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

  server.post<{ Body: { baseUrl?: string; apiKey?: string } }>('/api/models/discover', async (request, reply) => {
    const baseUrl = request.body.baseUrl;
    if (!baseUrl) {
      reply.code(400);
      return { error: 'Missing baseUrl in request body' };
    }

    const fetchBase = toDockerHostUrl(baseUrl);
    const isLocal = isLocalDiscoveryUrl(baseUrl) || isLocalDiscoveryUrl(fetchBase);

    if (!isLocal && (isPrivateUrl(baseUrl) || isPrivateUrl(fetchBase))) {
      reply.code(400);
      return { error: 'Requests to private/internal addresses are not allowed' };
    }

    const url = fetchBase.replace(/\/+$/, '') + '/models';
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 5000);

    try {
      const { resolvedUrl, originalHost } = await resolveAndValidateUrl(url);

      const headers: Record<string, string> = { Host: originalHost };
      if (request.body.apiKey) {
        headers.Authorization = `Bearer ${request.body.apiKey}`;
      }

      const response = await fetch(resolvedUrl, { signal: controller.signal, headers });

      if (!response.ok) {
        return { models: [] };
      }

      const bodyText = await readLimitedBody(response, MAX_RESPONSE_BODY_BYTES);
      const data = JSON.parse(bodyText) as { data?: { id: string }[] };
      const models = (data.data ?? []).map((m: { id: string }) => m.id);
      return { models };
    } catch {
      return { models: [] };
    } finally {
      clearTimeout(timeout);
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
