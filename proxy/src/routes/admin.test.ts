import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID, randomBytes } from 'crypto';
import { ProxyDatabase } from '../db/index.js';
import { registerAdminRoutes } from './admin.js';
import { hashToken, encrypt } from '../crypto/encryption.js';

// Response type helpers
interface ErrorResponse {
  error: string;
}

interface OkResponse {
  ok: boolean;
}

interface HealthResponse {
  status: string;
  keyCount: number;
  botCount: number;
}

interface KeyIdResponse {
  id: string;
}

interface TokenResponse {
  token: string;
}

interface KeyListItem {
  id: string;
  vendor: string;
  secret_encrypted?: unknown;
}

interface BotListItem {
  id: string;
  hostname: string;
  token_hash?: unknown;
}

describe('Admin Routes', () => {
  let testDir: string;
  let db: ProxyDatabase;
  let app: FastifyInstance;
  let masterKey: Buffer;
  const adminToken = 'test-admin-token-123';

  beforeEach(async () => {
    testDir = join(tmpdir(), `admin-routes-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    // Copy schema to test dir
    const srcSchemaPath = join(import.meta.dirname, '../db/schema.sql');
    const destSchemaPath = join(testDir, 'schema.sql');
    writeFileSync(destSchemaPath, readFileSync(srcSchemaPath, 'utf-8'));

    const dbPath = join(testDir, 'test.db');
    db = new ProxyDatabase(dbPath);
    masterKey = randomBytes(32);

    app = Fastify();
    registerAdminRoutes(app, db, masterKey, adminToken);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  function authHeaders() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  describe('Auth', () => {
    it('should reject requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponse>().error).toBe('Missing authorization');
    });

    it('should reject requests with invalid auth format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: { Authorization: 'Basic abc123' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponse>().error).toBe('Missing authorization');
    });

    it('should reject requests with wrong token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: { Authorization: 'Bearer wrong-token' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<ErrorResponse>().error).toBe('Invalid admin token');
    });

    it('should accept requests with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /admin/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<HealthResponse>();
      expect(body.status).toBe('ok');
      expect(body.keyCount).toBe(0);
      expect(body.botCount).toBe(0);
    });

    it('should include key and bot counts', async () => {
      // Add some keys and bots
      db.addKey('key-1', 'openai', encrypt('sk-123', masterKey));
      db.addKey('key-2', 'anthropic', encrypt('sk-456', masterKey));
      db.addBot('bot-1', 'test-bot', hashToken('token'));

      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: authHeaders(),
      });

      const body = response.json<HealthResponse>();
      expect(body.keyCount).toBe(2);
      expect(body.botCount).toBe(1);
    });
  });

  describe('POST /admin/keys', () => {
    it('should add a new key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/keys',
        headers: authHeaders(),
        payload: {
          vendor: 'openai',
          secret: 'sk-test-123',
          label: 'Test Key',
          tag: 'prod',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<KeyIdResponse>();
      expect(body.id).toBeDefined();

      // Verify key was added
      const key = db.getKey(body.id);
      expect(key).toBeDefined();
      if (key) {
        expect(key.vendor).toBe('openai');
        expect(key.label).toBe('Test Key');
        expect(key.tag).toBe('prod');
      }
    });

    it('should reject missing vendor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/keys',
        headers: authHeaders(),
        payload: { secret: 'sk-123' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toBe('Missing vendor or secret');
    });

    it('should reject missing secret', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/keys',
        headers: authHeaders(),
        payload: { vendor: 'openai' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toBe('Missing vendor or secret');
    });

    it('should reject unknown vendor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/keys',
        headers: authHeaders(),
        payload: { vendor: 'unknown-vendor', secret: 'key' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toContain('Unknown vendor');
    });
  });

  describe('GET /admin/keys', () => {
    it('should list all keys', async () => {
      db.addKey('key-1', 'openai', encrypt('sk-1', masterKey), 'Key 1');
      db.addKey('key-2', 'anthropic', encrypt('sk-2', masterKey), 'Key 2', 'prod');

      const response = await app.inject({
        method: 'GET',
        url: '/admin/keys',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<KeyListItem[]>();
      expect(body).toHaveLength(2);
      // Keys should NOT include secret_encrypted in response
      expect(body[0].id).toBeDefined();
      expect(body[0].vendor).toBeDefined();
      expect(body[0].secret_encrypted).toBeUndefined();
    });

    it('should return empty array when no keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/keys',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  describe('DELETE /admin/keys/:id', () => {
    it('should delete a key', async () => {
      db.addKey('key-to-delete', 'openai', encrypt('sk-123', masterKey));

      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/keys/key-to-delete',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<OkResponse>().ok).toBe(true);

      // Verify key was deleted
      expect(db.getKey('key-to-delete')).toBeUndefined();
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/keys/non-existent',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json<ErrorResponse>().error).toBe('Key not found');
    });
  });

  describe('POST /admin/bots', () => {
    it('should register a new bot', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/bots',
        headers: authHeaders(),
        payload: {
          botId: 'bot-123',
          hostname: 'test-bot',
          tags: ['prod', 'premium'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<TokenResponse>();
      expect(body.token).toBeDefined();
      expect(body.token.length).toBe(64); // 32 bytes hex

      // Verify bot was added
      const bot = db.getBot('bot-123');
      expect(bot).toBeDefined();
      if (bot) {
        expect(bot.hostname).toBe('test-bot');
        expect(bot.tags).toBe('["prod","premium"]');
      }
    });

    it('should reject missing botId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/bots',
        headers: authHeaders(),
        payload: { hostname: 'test-bot' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toBe('Missing botId or hostname');
    });

    it('should reject missing hostname', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/bots',
        headers: authHeaders(),
        payload: { botId: 'bot-123' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toBe('Missing botId or hostname');
    });

    it('should reject duplicate bot', async () => {
      db.addBot('bot-123', 'existing-bot', hashToken('token'));

      const response = await app.inject({
        method: 'POST',
        url: '/admin/bots',
        headers: authHeaders(),
        payload: { botId: 'bot-123', hostname: 'new-bot' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<ErrorResponse>().error).toBe('Bot already registered');
    });
  });

  describe('GET /admin/bots', () => {
    it('should list all bots', async () => {
      db.addBot('bot-1', 'bot-one', hashToken('token1'));
      db.addBot('bot-2', 'bot-two', hashToken('token2'), ['prod']);

      const response = await app.inject({
        method: 'GET',
        url: '/admin/bots',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<BotListItem[]>();
      expect(body).toHaveLength(2);
      // Should NOT include token_hash in response
      expect(body[0].id).toBeDefined();
      expect(body[0].hostname).toBeDefined();
      expect(body[0].token_hash).toBeUndefined();
    });
  });

  describe('DELETE /admin/bots/:id', () => {
    it('should delete a bot', async () => {
      db.addBot('bot-to-delete', 'test-bot', hashToken('token'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/bots/bot-to-delete',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<OkResponse>().ok).toBe(true);

      // Verify bot was deleted
      expect(db.getBot('bot-to-delete')).toBeUndefined();
    });

    it('should return 404 for non-existent bot', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/bots/non-existent',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json<ErrorResponse>().error).toBe('Bot not found');
    });
  });
});
