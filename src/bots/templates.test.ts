import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createBotWorkspace, getBotWorkspacePath, deleteBotWorkspace, getApiTypeForProvider, getMemorySearchConfig, type BotWorkspaceConfig } from './templates.js';

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

  describe('getApiTypeForProvider', () => {
    const openaiCompletionsProviders = [
      'venice', 'openrouter', 'ollama', 'grok',
      'deepseek', 'mistral', 'groq', 'cerebras', 'fireworks',
      'togetherai', 'deepinfra', 'perplexity', 'nvidia',
      'minimax', 'moonshot', 'scaleway', 'nebius', 'ovhcloud', 'huggingface',
    ];

    it.each(openaiCompletionsProviders)('%s returns openai-completions', (provider) => {
      expect(getApiTypeForProvider(provider)).toBe('openai-completions');
    });

    it('anthropic returns anthropic-messages', () => {
      expect(getApiTypeForProvider('anthropic')).toBe('anthropic-messages');
    });

    it('google returns google-gemini', () => {
      expect(getApiTypeForProvider('google')).toBe('google-gemini');
    });

    it('openai returns openai-responses', () => {
      expect(getApiTypeForProvider('openai')).toBe('openai-responses');
    });
  });

  describe('getMemorySearchConfig', () => {
    const proxy = { baseUrl: 'http://proxy:9101/v1/openai', token: 'tok-123' };

    it.each([
      ['openai', 'text-embedding-3-small'],
      ['mistral', 'mistral-embed'],
      ['ollama', 'nomic-embed-text'],
      ['deepseek', 'text-embedding-3-small'],
    ])('%s with proxy returns embedding model %s', (provider, model) => {
      expect(getMemorySearchConfig(provider, proxy)).toEqual({
        provider: 'openai',
        model,
        remote: { baseUrl: proxy.baseUrl, apiKey: proxy.token },
      });
    });

    it.each([
      'anthropic', 'google', 'groq', 'cerebras', 'perplexity', 'moonshot', 'ovhcloud',
    ])('%s returns disabled', (provider) => {
      expect(getMemorySearchConfig(provider, proxy)).toEqual({ enabled: false });
    });

    it('unknown provider returns disabled', () => {
      expect(getMemorySearchConfig('nonexistent', proxy)).toEqual({ enabled: false });
    });

    it('no proxy returns disabled even for supported provider', () => {
      expect(getMemorySearchConfig('openai')).toEqual({ enabled: false });
    });
  });

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
      // AGENTS.md and BOOTSTRAP.md are NOT written by BotMaker;
      // OpenClaw's ensureAgentWorkspace() creates them from its own templates
      expect(existsSync(join(workspaceDir, 'AGENTS.md'))).toBe(false);
      expect(existsSync(join(workspaceDir, 'BOOTSTRAP.md'))).toBe(false);
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
      const defaults = (openclawConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>;
      expect(defaults.model).toEqual({ primary: 'openai/gpt-4' });
      expect(defaults.memorySearch).toEqual({ enabled: false });
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

      const defaults = (openclawConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>;
      expect(defaults.memorySearch).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        remote: {
          baseUrl: 'http://proxy:9101/v1',
          apiKey: 'proxy-token-123',
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

    it('should use anthropic-messages API type for anthropic with proxy', () => {
      const config = createTestConfig({
        aiProvider: 'anthropic',
        model: 'claude-3-opus',
        proxy: {
          baseUrl: 'http://proxy:9101/v1/anthropic',
          token: 'proxy-token-123',
        },
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;

      expect(openclawConfig.models).toEqual({
        providers: {
          'anthropic-proxy': {
            baseUrl: 'http://proxy:9101/v1/anthropic',
            apiKey: 'proxy-token-123',
            api: 'anthropic-messages',
            models: [{ id: 'claude-3-opus', name: 'claude-3-opus' }],
          },
        },
      });

      const defaults = (openclawConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>;
      expect(defaults.memorySearch).toEqual({ enabled: false });
    });

    it('should use openai-completions API type for venice with proxy', () => {
      const config = createTestConfig({
        aiProvider: 'venice',
        model: 'llama-3.3-70b',
        proxy: {
          baseUrl: 'http://proxy:9101/v1/venice',
          token: 'proxy-token-123',
        },
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;
      const models = openclawConfig.models as Record<string, unknown>;
      const providers = models.providers as Record<string, unknown>;
      const veniceProxy = providers['venice-proxy'] as Record<string, unknown>;

      expect(veniceProxy.api).toBe('openai-completions');
    });

    it('should use openai-completions API type for grok with proxy', () => {
      const config = createTestConfig({
        aiProvider: 'grok',
        model: 'grok-4-1-fast',
        proxy: {
          baseUrl: 'http://proxy:9101/v1/grok',
          token: 'proxy-token-123',
        },
      });
      createBotWorkspace(testDir, config);

      const openclawPath = join(testDir, 'bots', config.botHostname, 'openclaw.json');
      const openclawConfig = JSON.parse(readFileSync(openclawPath, 'utf-8')) as Record<string, unknown>;
      const models = openclawConfig.models as Record<string, unknown>;
      const providers = models.providers as Record<string, unknown>;
      const grokProxy = providers['grok-proxy'] as Record<string, unknown>;

      expect(grokProxy.api).toBe('openai-completions');
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
      expect(soul).toContain('I assist with tasks');

      const identity = readFileSync(join(workspaceDir, 'IDENTITY.md'), 'utf-8');
      expect(identity).toContain('Buddy');
      expect(identity).toContain('A friendly helper');
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
