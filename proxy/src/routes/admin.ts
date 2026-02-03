import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { timingSafeEqual } from 'node:crypto';
import type { ProxyDatabase } from '../db/index.js';
import { encrypt, generateToken, hashToken } from '../crypto/encryption.js';
import { VENDOR_CONFIGS } from '../types.js';

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

interface AddKeyBody {
  vendor: string;
  secret: string;
  label?: string;
  tag?: string;
}

interface AddBotBody {
  botId: string;
  hostname: string;
  tags?: string[];
}

export function registerAdminRoutes(
  app: FastifyInstance,
  db: ProxyDatabase,
  masterKey: Buffer,
  adminToken: string
): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing authorization' });
      return;
    }

    const token = auth.slice(7);
    if (!safeCompare(token, adminToken)) {
      reply.status(403).send({ error: 'Invalid admin token' });
      return;
    }
  });

  app.get('/admin/health', () => {
    return {
      status: 'ok',
      keyCount: db.countKeys(),
      botCount: db.countBots(),
    };
  });

  app.post('/admin/keys', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as AddKeyBody;

    if (!body.vendor || !body.secret) {
      reply.status(400).send({ error: 'Missing vendor or secret' });
      return;
    }

    if (!(body.vendor in VENDOR_CONFIGS)) {
      reply.status(400).send({ error: `Unknown vendor: ${body.vendor}` });
      return;
    }

    const id = uuidv4();
    const secretEncrypted = encrypt(body.secret, masterKey);

    db.addKey(id, body.vendor, secretEncrypted, body.label, body.tag);

    return { id };
  });

  app.get('/admin/keys', () => {
    return db.listKeys();
  });

  app.delete('/admin/keys/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const deleted = db.deleteKey(id);

    if (!deleted) {
      reply.status(404).send({ error: 'Key not found' });
      return;
    }

    return { ok: true };
  });

  app.post('/admin/bots', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as AddBotBody;

    if (!body.botId || !body.hostname) {
      reply.status(400).send({ error: 'Missing botId or hostname' });
      return;
    }

    const existing = db.getBot(body.botId);
    if (existing) {
      reply.status(409).send({ error: 'Bot already registered' });
      return;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    db.addBot(body.botId, body.hostname, tokenHash, body.tags);

    return { token };
  });

  app.get('/admin/bots', () => {
    return db.listBots();
  });

  app.delete('/admin/bots/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const deleted = db.deleteBot(id);

    if (!deleted) {
      reply.status(404).send({ error: 'Bot not found' });
      return;
    }

    return { ok: true };
  });
}
