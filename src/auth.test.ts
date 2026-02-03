import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sessions, createSession, validateSession, invalidateSession } from './server.js';

interface LoginResponse {
  token?: string;
  error?: string;
}

interface ErrorResponse {
  error: string;
}

describe('Session Management', () => {
  beforeEach(() => {
    sessions.clear();
  });

  afterEach(() => {
    sessions.clear();
  });

  describe('createSession', () => {
    it('should create a session token', () => {
      const token = createSession(60000);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex encoded
    });

    it('should store session with expiry', () => {
      const expiryMs = 60000;
      const before = Date.now();
      const token = createSession(expiryMs);
      const after = Date.now();

      const session = sessions.get(token);
      expect(session).toBeDefined();
      if (!session) throw new Error('Session not found');
      expect(session.token).toBe(token);
      expect(session.expiresAt).toBeGreaterThanOrEqual(before + expiryMs);
      expect(session.expiresAt).toBeLessThanOrEqual(after + expiryMs);
    });
  });

  describe('validateSession', () => {
    it('should return true for valid session', () => {
      const token = createSession(60000);
      expect(validateSession(token)).toBe(true);
    });

    it('should return false for unknown token', () => {
      expect(validateSession('unknown-token')).toBe(false);
    });

    it('should return false for expired session', () => {
      const token = createSession(1); // 1ms expiry
      // Wait for expiry
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }
      expect(validateSession(token)).toBe(false);
    });

    it('should remove expired session from store', () => {
      const token = createSession(1);
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }
      validateSession(token);
      expect(sessions.has(token)).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    it('should remove session from store', () => {
      const token = createSession(60000);
      expect(sessions.has(token)).toBe(true);
      invalidateSession(token);
      expect(sessions.has(token)).toBe(false);
    });

    it('should not throw for unknown token', () => {
      expect(() => { invalidateSession('unknown'); }).not.toThrow();
    });
  });
});

describe('Login/Logout API', () => {
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

  async function createTestServer(password: string) {
    process.env.ADMIN_PASSWORD = password;
    // Mock docker service to avoid actual Docker calls
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

  it('should login with correct password', async () => {
    const server = await createTestServer('test-password');
    const response = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'test-password' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as LoginResponse;
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    await server.close();
  });

  it('should reject login with wrong password', async () => {
    const server = await createTestServer('test-password');
    const response = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toBe('Invalid password');
    await server.close();
  });

  it('should reject login with missing password', async () => {
    const server = await createTestServer('test-password');
    const response = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toBe('Password is required');
    await server.close();
  });

  it('should allow API access with valid session token', async () => {
    const server = await createTestServer('test-password');

    // Login first
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'test-password' },
    });
    const { token } = JSON.parse(loginResponse.body) as LoginResponse;

    // Access API with token
    const response = await server.inject({
      method: 'GET',
      url: '/api/bots',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it('should reject API access without token', async () => {
    const server = await createTestServer('test-password');
    const response = await server.inject({
      method: 'GET',
      url: '/api/bots',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toBe('Missing authorization');
    await server.close();
  });

  it('should reject API access with invalid token', async () => {
    const server = await createTestServer('test-password');
    const response = await server.inject({
      method: 'GET',
      url: '/api/bots',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body) as ErrorResponse;
    expect(body.error).toBe('Invalid or expired session');
    await server.close();
  });

  it('should logout and invalidate token', async () => {
    const server = await createTestServer('test-password');

    // Login
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'test-password' },
    });
    const { token } = JSON.parse(loginResponse.body) as LoginResponse;

    // Logout
    const logoutResponse = await server.inject({
      method: 'POST',
      url: '/api/logout',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutResponse.statusCode).toBe(200);

    // Try to use token again
    const response = await server.inject({
      method: 'GET',
      url: '/api/bots',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    await server.close();
  });
});

describe('Password Length Validation', () => {
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

  function setupMocks() {
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
  }

  it('should reject password shorter than 12 characters', async () => {
    process.env.ADMIN_PASSWORD = 'short';
    setupMocks();
    const { buildServer } = await import('./server.js');
    await expect(buildServer()).rejects.toThrow('ADMIN_PASSWORD must be at least 12 characters');
  });

  it('should accept password of exactly 12 characters', async () => {
    process.env.ADMIN_PASSWORD = '123456789012';
    setupMocks();
    const { buildServer } = await import('./server.js');
    const server = await buildServer();
    expect(server).toBeDefined();
    await server.close();
  });
});

describe('Timing-safe comparison', () => {
  it('should compare equal strings correctly', async () => {
    // We test this indirectly through login
    process.env.ADMIN_PASSWORD = 'test-password';
    vi.doMock('./services/DockerService.js', () => ({
      DockerService: class {
        getVolumeMountpoint = vi.fn().mockResolvedValue('/tmp/test');
      },
    }));
    vi.doMock('./db/index.js', () => ({
      initDb: vi.fn(),
      getDb: vi.fn().mockReturnValue({ transaction: vi.fn(() => vi.fn()) }),
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
    const server = await buildServer();

    // Same password should work
    const response = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'test-password' },
    });
    expect(response.statusCode).toBe(200);

    // Different length password should fail
    const response2 = await server.inject({
      method: 'POST',
      url: '/api/login',
      payload: { password: 'test' },
    });
    expect(response2.statusCode).toBe(401);
    await server.close();
  });
});
