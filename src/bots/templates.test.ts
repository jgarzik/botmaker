import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createBotWorkspace, getBotWorkspacePath, deleteBotWorkspace, type BotWorkspaceConfig } from './templates.js';

describe('templates', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `botmaker-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function createTestConfig(overrides: Partial<BotWorkspaceConfig> = {}): BotWorkspaceConfig {
    return {
      botId: 'test-bot-id',
      botHostname: 'test-bot',
      botName: 'Test Bot',
      aiProvider: 'openai',
      model: 'gpt-4',
      channel: { type: 'telegram', token: 'tg-token-123' },
      persona: {
        name: 'TestBot',
        identity: 'A helpful test assistant',
        description: 'I help with testing',
      },
      port: 19000,
      ...overrides,
    };
  }

  describe('getBotWorkspacePath', () => {
    it('should return correct path', () => {
      const result = getBotWorkspacePath('/data', 'my-bot');
      expect(result).toBe('/data/bots/my-bot');
    });

    it('should handle nested data directory', () => {
      const result = getBotWorkspacePath('/var/lib/botmaker/data', 'bot-1');
      expect(result).toBe('/var/lib/botmaker/data/bots/bot-1');
    });
  });

  describe('createBotWorkspace', () => {
    it('should create bot directory structure', () => {
      const config = createTestConfig();
      createBotWorkspace(testDir, config);

      const botDir = join(testDir, 'bots', config.botHostname);
      expect(existsSync(botDir)).toBe(true);
      expect(existsSync(join(botDir, 'workspace'))).toBe(true);
      expect(existsSync(join(botDir, 'openclaw.json'))).toBe(true);
    });

    it('should create workspace files', () => {
      const config = createTestConfig();
      createBotWorkspace(testDir, config);

      const workspaceDir = join(testDir, 'bots', config.botHostname, 'workspace');
      expect(existsSync(join(workspaceDir, 'SOUL.md'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'IDENTITY.md'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'BOOTSTRAP.md'))).toBe(true);
    });

    it('should create openclaw.json without proxy', () => {
      const config = createTestConfig();
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;

      expect(openclawConfig.gateway).toEqual({
        mode: 'local',
        port: 19000,
        bind: 'lan',
        auth: { mode: 'token' },
        controlUi: { allowInsecureAuth: true },
      });
      expect((openclawConfig.channels as Record<string, unknown>).telegram).toEqual({ enabled: true });
      expect(((openclawConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>).model).toEqual({ primary: 'openai/gpt-4' });
      expect(openclawConfig.models).toBeUndefined();
    });

    it('should create openclaw.json with proxy', () => {
      const config = createTestConfig({
        proxy: {
          baseUrl: 'http://proxy:9101/v1',
          token: 'proxy-token-123',
        },
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;

      expect(openclawConfig.models).toEqual({
        providers: {
          'openai-proxy': {
            baseUrl: 'http://proxy:9101/v1',
            apiKey: 'proxy-token-123',
            api: 'openai-responses',
            models: [{ id: 'gpt-4', name: 'gpt-4' }],
          },
        },
      });
    });

    it('should create sessions and sandbox directories', () => {
      const config = createTestConfig();
      createBotWorkspace(testDir, config);

      const botDir = join(testDir, 'bots', config.botHostname);
      expect(existsSync(join(botDir, 'agents', 'main', 'sessions'))).toBe(true);
      expect(existsSync(join(botDir, 'sandbox'))).toBe(true);
    });

    it('should handle discord channel', () => {
      const config = createTestConfig({
        channel: { type: 'discord', token: 'dc-token-123' },
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;
      const channels = openclawConfig.channels as Record<string, unknown>;

      expect(channels.discord).toEqual({ enabled: true });
      expect(channels.telegram).toBeUndefined();
    });

    it('should handle anthropic provider', () => {
      const config = createTestConfig({
        aiProvider: 'anthropic',
        model: 'claude-3-opus',
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;
      const agents = openclawConfig.agents as Record<string, unknown>;
      const defaults = agents.defaults as Record<string, unknown>;
      const model = defaults.model as Record<string, unknown>;

      expect(model.primary).toBe('anthropic/claude-3-opus');
    });

    it('should include persona in workspace files', () => {
      const config = createTestConfig({
        persona: {
          name: 'Buddy',
          identity: 'A friendly helper',
          description: 'I assist with tasks',
        },
      });
      createBotWorkspace(testDir, config);

      const workspaceDir = join(testDir, 'bots', config.botHostname, 'workspace');

      const soul = readFileSync(join(workspaceDir, 'SOUL.md'), 'utf-8');
      expect(soul).toContain('A friendly helper');
      expect(soul).toContain('Buddy');

      const identity = readFileSync(join(workspaceDir, 'IDENTITY.md'), 'utf-8');
      expect(identity).toContain('Buddy');

      const agents = readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('Buddy');
      expect(agents).toContain('I assist with tasks');
    });
  });

  describe('deleteBotWorkspace', () => {
    it('should delete bot workspace', () => {
      const config = createTestConfig();
      createBotWorkspace(testDir, config);

      const botDir = join(testDir, 'bots', config.botHostname);
      expect(existsSync(botDir)).toBe(true);

      deleteBotWorkspace(testDir, config.botHostname);
      expect(existsSync(botDir)).toBe(false);
    });

    it('should not throw for non-existent workspace', () => {
      deleteBotWorkspace(testDir, 'non-existent-bot');
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });

    it('should leave other bot workspaces intact', () => {
      const config1 = createTestConfig({ botHostname: 'bot-1' });
      const config2 = createTestConfig({ botHostname: 'bot-2' });

      createBotWorkspace(testDir, config1);
      createBotWorkspace(testDir, config2);

      deleteBotWorkspace(testDir, 'bot-1');

      expect(existsSync(join(testDir, 'bots', 'bot-1'))).toBe(false);
      expect(existsSync(join(testDir, 'bots', 'bot-2'))).toBe(true);
    });
  });
});
