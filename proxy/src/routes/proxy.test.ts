import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID, randomBytes } from 'crypto';
import { ProxyDatabase } from '../db/index.js';
import { KeyringService } from '../services/keyring.js';
import { registerProxyRoutes } from './proxy.js';
import { hashToken, encrypt } from '../crypto/encryption.js';

// Mock upstream to avoid real HTTP calls
vi.mock('../services/upstream.js', () => ({
  forwardToUpstream: vi.fn(async (req, reply) => {
    // Echo back the path so tests can verify query params are preserved
    reply.status(200).send({ proxiedPath: req.path, vendor: req.vendorConfig.host });
    return 200;
  }),
}));

import { forwardToUpstream } from '../services/upstream.js';

interface ErrorResponse {
  error: string;
}

interface ProxiedResponse {
  proxiedPath: string;
  vendor: string;
}

describe('Proxy Routes', () => {
  let testDir: string;
  let db: ProxyDatabase;
  let app: FastifyInstance;
  let masterKey: Buffer;
  let keyring: KeyringService;
  const botToken = 'test-bot-token-abc123';

  beforeEach(async () => {
    testDir = join(tmpdir(), `proxy-routes-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    const srcSchemaPath = join(import.meta.dirname, '../db/schema.sql');
    const destSchemaPath = join(testDir, 'schema.sql');
    writeFileSync(destSchemaPath, readFileSync(srcSchemaPath, 'utf-8'));

    const dbPath = join(testDir, 'test.db');
    db = new ProxyDatabase(dbPath);
    masterKey = randomBytes(32);
    keyring = new KeyringService(db, masterKey);

    // Register a bot
    db.addBot('bot-1', 'test-bot', hashToken(botToken));

    // Register an API key for openai and google vendors
    db.addKey(randomUUID(), 'openai', encrypt('sk-real-key', masterKey));
    db.addKey(randomUUID(), 'google', encrypt('google-real-key', masterKey));

    app = Fastify();
    registerProxyRoutes(app, db, keyring);
    await app.ready();

    vi.mocked(forwardToUpstream).mockClear();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Bot token extraction', () => {
    it('should accept Authorization: Bearer header (OpenAI-style)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/openai/chat/completions',
        headers: { Authorization: `Bearer ${botToken}` },
        payload: { model: 'gpt-4' },
      });

      expect(response.statusCode).toBe(200);
      expect(forwardToUpstream).toHaveBeenCalled();
    });

    it('should accept x-api-key header (Anthropic-style)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/openai/chat/completions',
        headers: { 'x-api-key': botToken },
        payload: { model: 'gpt-4' },
      });

      expect(response.statusCode).toBe(200);
      expect(forwardToUpstream).toHaveBeenCalled();
    });

    it('should accept x-goog-api-key header (Google-style)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/google/models/gemini-2.0-flash:generateContent',
        headers: { 'x-goog-api-key': botToken },
        payload: { contents: [] },
      });

      expect(response.statusCode).toBe(200);
      expect(forwardToUpstream).toHaveBeenCalled();
    });

    it('should return 401 when no auth header is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/openai/chat/completions',
        payload: { model: 'gpt-4' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponse>().error).toBe('Missing authorization');
    });

    it('should return 403 for invalid bot token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/openai/chat/completions',
        headers: { Authorization: 'Bearer wrong-token' },
        payload: { model: 'gpt-4' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<ErrorResponse>().error).toBe('Invalid bot token');
    });
  });

  describe('Query parameter forwarding', () => {
    it('should preserve query parameters when forwarding to upstream', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/google/models/gemini-2.0-flash:streamGenerateContent?alt=sse',
        headers: { 'x-goog-api-key': botToken },
        payload: { contents: [] },
      });

      expect(forwardToUpstream).toHaveBeenCalled();
      const call = vi.mocked(forwardToUpstream).mock.calls[0][0];
      expect(call.path).toContain('?alt=sse');
    });

    it('should preserve multiple query parameters', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/google/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=abc',
        headers: { 'x-goog-api-key': botToken },
        payload: { contents: [] },
      });

      const call = vi.mocked(forwardToUpstream).mock.calls[0][0];
      expect(call.path).toContain('?alt=sse&key=abc');
    });

    it('should work without query parameters', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/openai/chat/completions',
        headers: { Authorization: `Bearer ${botToken}` },
        payload: { model: 'gpt-4' },
      });

      const call = vi.mocked(forwardToUpstream).mock.calls[0][0];
      expect(call.path).toBe('/chat/completions');
    });
  });

  describe('Vendor validation', () => {
    it('should return 400 for unknown vendor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/unknown-vendor/chat/completions',
        headers: { Authorization: `Bearer ${botToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toContain('Unknown vendor');
    });

    it('should return 503 when no API keys available for vendor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/anthropic/v1/messages',
        headers: { 'x-api-key': botToken },
        payload: {},
      });

      // No anthropic key was registered in beforeEach
      expect(response.statusCode).toBe(503);
      expect(response.json<ErrorResponse>().error).toContain('No API keys available');
    });
  });
});
