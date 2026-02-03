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
    const path = '/' + (req.params as { '*': string })['*'];

    // Validate vendor
    if (!(vendor in VENDOR_CONFIGS)) {
      reply.status(400).send({ error: `Unknown vendor: ${vendor}` });
      return;
    }
    const vendorConfig = VENDOR_CONFIGS[vendor];

    // Extract and validate bot token
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing authorization' });
      return;
    }

    const botToken = auth.slice(7);
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
    const keySelection = keyring.selectKeyForBot(vendor, botTags);
    if (!keySelection) {
      reply.status(503).send({ error: `No API keys available for vendor: ${vendor}` });
      return;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value[0];
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
          apiKey: keySelection.secret,
        },
        reply
      );

      // Log usage
      db.logUsage(bot.id, vendor, keySelection.keyId, statusCode);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      db.logUsage(bot.id, vendor, keySelection.keyId, null);
      reply.status(502).send({ error: `Upstream error: ${errorMessage}` });
    }
  });
}
