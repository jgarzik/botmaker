import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sessions } from './server.js';

interface ErrorResponse {
  error: string;
}

async function createTestServer(): Promise<FastifyInstance> {
  process.env.ADMIN_PASSWORD = 'test-password-long';
  vi.doMock('./services/DockerService.js', () => ({
    DockerService: class {
      getContainerStatus = vi.fn().mockResolvedValue(null);
      getAllContainerStats = vi.fn().mockResolvedValue([]);
      getVolumeMountpoint = vi.fn().mockResolvedValue('/tmp/test');
    },
  }));
  vi.doMock('./db/index.js', () => ({
    initDb: vi.fn(),
    getDb: vi.fn().mockReturnValue({ transaction: vi.fn(() => vi.fn()) }),
  }));
  vi.doMock('./bots/store.js', () => ({
    listBots: vi.fn().mockReturnValue([]),
  }));
  vi.doMock('./services/ReconciliationService.js', () => ({
    ReconciliationService: class {
      reconcileOnStartup = vi.fn().mockResolvedValue({
        orphanedContainers: [],
        orphanedWorkspaces: [],
        orphanedSecrets: [],
      });
    },
  }));

  const { buildServer } = await import('./server.js');
  return buildServer();
}

async function getAuthToken(server: FastifyInstance): Promise<string> {
  const response = await server.inject({
    method: 'POST',
    url: '/api/login',
    payload: { password: 'test-password-long' },
  });
  const body = JSON.parse(response.body) as { token: string };
  return body.token;
}

describe('/api/models/discover', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sessions.clear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    sessions.clear();
    vi.resetModules();
  });

  it('should require authentication', async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'https://api.openai.com/v1' },
    });
    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('should reject missing baseUrl', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/baseUrl/i);
    await server.close();
  });

  it('should reject private IPv4 addresses (10.x)', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://10.0.0.1/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject private IPv4 addresses (192.168.x)', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://192.168.1.1/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should allow localhost for local discovery (Ollama)', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://localhost:11434/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    // Allowed through SSRF check; fetch fails → returns empty models
    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it('should allow 127.0.0.1 for local discovery', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://127.0.0.1:11434/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it('should reject non-http protocols', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'ftp://example.com/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject link-local IPv6', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://[fe80::1]/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject IPv6 loopback', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://[::1]/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject .local domains', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://myhost.local/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject 172.16.x private range', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'http://172.16.0.1/v1' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });

  it('should reject invalid URL', async () => {
    const server = await createTestServer();
    const token = await getAuthToken(server);
    const response = await server.inject({
      method: 'POST',
      url: '/api/models/discover',
      payload: { baseUrl: 'not-a-url' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toMatch(/private/i);
    await server.close();
  });
});
