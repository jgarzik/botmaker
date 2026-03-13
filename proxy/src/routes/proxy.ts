import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ProxyDatabase } from '../db/index.js';
import type { KeyringService } from '../services/keyring.js';
import { hashToken } from '../crypto/encryption.js';
import { forwardToUpstream } from '../services/upstream.js';
import { VENDOR_CONFIGS } from '../types.js';

export function registerProxyRoutes(
  app: FastifyInstance,
  db: ProxyDatabase,
  keyring: KeyringService
): void {
  // Catch-all route for proxy requests: /v1/{vendor}/{path...}
  app.all('/v1/:vendor/*', async (req: FastifyRequest, reply: FastifyReply) => {
    const { vendor } = req.params as { vendor: string; '*': string };
    const rawPath = '/' + (req.params as { '*': string })['*'];
    // Preserve query string — Fastify strips it from wildcard params
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const path = rawPath + queryString;

    // Validate vendor
    if (!(vendor in VENDOR_CONFIGS)) {
      reply.status(400).send({ error: `Unknown vendor: ${vendor}` });
      return;
    }
    const vendorConfig = VENDOR_CONFIGS[vendor];

    // Extract bot token from auth header — each vendor SDK sends it differently
    // OpenAI-style: Authorization: Bearer <token>
    // Anthropic-style: x-api-key: <token>
    // Google-style: x-goog-api-key: <token>
    let botToken: string | undefined;

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      botToken = auth.slice(7);
    } else if (req.headers['x-api-key'] && typeof req.headers['x-api-key'] === 'string') {
      botToken = req.headers['x-api-key'];
    } else if (req.headers['x-goog-api-key'] && typeof req.headers['x-goog-api-key'] === 'string') {
      botToken = req.headers['x-goog-api-key'];
    }

    if (!botToken) {
      reply.status(401).send({ error: 'Missing authorization' });
      return;
    }
    const tokenHash = hashToken(botToken);

    // Lookup bot
    const bot = db.getBotByTokenHash(tokenHash);
    if (!bot) {
      reply.status(403).send({ error: 'Invalid bot token' });
      return;
    }

    // Parse bot tags from JSON
    let botTags: string[] | null = null;
    if (bot.tags) {
      try {
        botTags = JSON.parse(bot.tags) as string[];
      } catch {
        reply.status(500).send({ error: 'Invalid bot tags configuration' });
        return;
      }
    }

    // Select API key for vendor with tag-based routing
    let apiKey = '';
    let keyId: string | null = null;

    if (vendorConfig.noAuth) {
      // No API key needed (e.g., local Ollama)
    } else {
      const keySelection = keyring.selectKeyForBot(vendor, botTags);
      if (!keySelection) {
        reply.status(503).send({ error: `No API keys available for vendor: ${vendor}` });
        return;
      }
      apiKey = keySelection.secret;
      keyId = keySelection.keyId;
    }

    const FORWARDED_HEADERS = ['content-type', 'accept', 'user-agent'];
    const headers: Record<string, string> = {};
    for (const name of FORWARDED_HEADERS) {
      const value = req.headers[name];
      if (typeof value === 'string') {
        headers[name] = value;
      } else if (Array.isArray(value)) {
        headers[name] = value[0];
      }
    }

    let body: Buffer | null = null;
    if (req.body) {
      body = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf8');
    }

    // Forward to upstream
    try {
      const statusCode = await forwardToUpstream(
        {
          vendorConfig,
          path,
          method: req.method,
          headers,
          body,
          apiKey,
          forceNonStreaming: vendorConfig.forceNonStreaming,
        },
        reply
      );

      // Log usage
      db.logUsage(bot.id, vendor, keyId, statusCode);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      db.logUsage(bot.id, vendor, keyId, null);
      reply.status(502).send({ error: `Upstream error: ${errorMessage}` });
    }
  });
}
