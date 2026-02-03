import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID, randomBytes } from 'crypto';
import { ProxyDatabase } from './index.js';

describe('ProxyDatabase', () => {
  let testDir: string;
  let db: ProxyDatabase | undefined;
  let schemaPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `proxy-db-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    // Copy schema.sql to test directory (ProxyDatabase reads from __dirname)
    // Instead, we'll create the database in the same directory as schema.sql
    const srcSchemaPath = join(import.meta.dirname, 'schema.sql');
    schemaPath = join(testDir, 'schema.sql');
    writeFileSync(schemaPath, readFileSync(srcSchemaPath, 'utf-8'));

    // Create database - need to work around __dirname issue
    // ProxyDatabase reads schema from same dir as index.js

    // We need to manually init since ProxyDatabase reads schema from __dirname
    // For testing, we'll use the actual ProxyDatabase pointing to a temp file
  });

  afterEach(() => {
    db?.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  // Helper to create DB with proper schema location
  function createTestDb(): ProxyDatabase {
    const dbPath = join(testDir, 'test.db');
    // ProxyDatabase constructor reads schema from __dirname relative to index.js
    // In test environment, this should work since we're importing the actual module
    return new ProxyDatabase(dbPath);
  }

  describe('Key CRUD', () => {
    it('should add and get a key', () => {
      db = createTestDb();
      const id = randomUUID();
      const secretEncrypted = randomBytes(64);

      db.addKey(id, 'openai', secretEncrypted, 'Test Key', 'prod');

      const key = db.getKey(id);
      expect(key).toBeDefined();
      if (key) {
        expect(key.id).toBe(id);
        expect(key.vendor).toBe('openai');
        expect(key.label).toBe('Test Key');
        expect(key.tag).toBe('prod');
        expect(Buffer.from(key.secret_encrypted).equals(secretEncrypted)).toBe(true);
      }
    });

    it('should add key without label and tag', () => {
      db = createTestDb();
      const id = randomUUID();
      const secretEncrypted = randomBytes(64);

      db.addKey(id, 'anthropic', secretEncrypted);

      const key = db.getKey(id);
      expect(key).toBeDefined();
      if (key) {
        expect(key.label).toBeNull();
        expect(key.tag).toBeNull();
      }
    });

    it('should return undefined for non-existent key', () => {
      db = createTestDb();
      const key = db.getKey('non-existent-id');
      expect(key).toBeUndefined();
    });

    it('should list all keys', () => {
      db = createTestDb();
      db.addKey('key-1', 'openai', randomBytes(64), 'Key 1');
      db.addKey('key-2', 'anthropic', randomBytes(64), 'Key 2');
      db.addKey('key-3', 'venice', randomBytes(64), 'Key 3');

      const keys = db.listKeys();
      expect(keys).toHaveLength(3);
      expect(keys.map(k => k.id)).toContain('key-1');
      expect(keys.map(k => k.id)).toContain('key-2');
      expect(keys.map(k => k.id)).toContain('key-3');
    });

    it('should delete a key', () => {
      db = createTestDb();
      const id = randomUUID();
      db.addKey(id, 'openai', randomBytes(64));

      const deleted = db.deleteKey(id);
      expect(deleted).toBe(true);

      const key = db.getKey(id);
      expect(key).toBeUndefined();
    });

    it('should return false when deleting non-existent key', () => {
      db = createTestDb();
      const deleted = db.deleteKey('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should count keys', () => {
      db = createTestDb();
      expect(db.countKeys()).toBe(0);

      db.addKey('key-1', 'openai', randomBytes(64));
      expect(db.countKeys()).toBe(1);

      db.addKey('key-2', 'openai', randomBytes(64));
      expect(db.countKeys()).toBe(2);

      db.deleteKey('key-1');
      expect(db.countKeys()).toBe(1);
    });

    it('should get keys by vendor', () => {
      db = createTestDb();
      db.addKey('key-1', 'openai', randomBytes(64));
      db.addKey('key-2', 'openai', randomBytes(64));
      db.addKey('key-3', 'anthropic', randomBytes(64));

      const openaiKeys = db.getKeysByVendor('openai');
      expect(openaiKeys).toHaveLength(2);

      const anthropicKeys = db.getKeysByVendor('anthropic');
      expect(anthropicKeys).toHaveLength(1);

      const veniceKeys = db.getKeysByVendor('venice');
      expect(veniceKeys).toHaveLength(0);
    });

    it('should get keys by vendor and tag', () => {
      db = createTestDb();
      db.addKey('key-1', 'openai', randomBytes(64), undefined, 'prod');
      db.addKey('key-2', 'openai', randomBytes(64), undefined, 'dev');
      db.addKey('key-3', 'openai', randomBytes(64), undefined, 'prod');

      const prodKeys = db.getKeysByVendorAndTag('openai', 'prod');
      expect(prodKeys).toHaveLength(2);

      const devKeys = db.getKeysByVendorAndTag('openai', 'dev');
      expect(devKeys).toHaveLength(1);
    });

    it('should get default (untagged) keys for vendor', () => {
      db = createTestDb();
      db.addKey('key-1', 'openai', randomBytes(64), undefined, 'prod');
      db.addKey('key-2', 'openai', randomBytes(64), undefined, undefined);
      db.addKey('key-3', 'openai', randomBytes(64), undefined, undefined);

      const defaultKeys = db.getDefaultKeysForVendor('openai');
      expect(defaultKeys).toHaveLength(2);
      expect(defaultKeys.every(k => k.tag === null)).toBe(true);
    });
  });

  describe('Bot CRUD', () => {
    it('should add and get a bot', () => {
      db = createTestDb();
      const id = randomUUID();
      const tokenHash = 'hash123';

      db.addBot(id, 'test-bot', tokenHash, ['prod', 'premium']);

      const bot = db.getBot(id);
      expect(bot).toBeDefined();
      if (bot) {
        expect(bot.id).toBe(id);
        expect(bot.hostname).toBe('test-bot');
        expect(bot.token_hash).toBe(tokenHash);
        expect(bot.tags).toBe('["prod","premium"]');
      }
    });

    it('should add bot without tags', () => {
      db = createTestDb();
      const id = randomUUID();

      db.addBot(id, 'test-bot', 'hash123');

      const bot = db.getBot(id);
      expect(bot).toBeDefined();
      if (bot) {
        expect(bot.tags).toBeNull();
      }
    });

    it('should get bot by token hash', () => {
      db = createTestDb();
      const id = randomUUID();
      const tokenHash = 'unique-hash-456';

      db.addBot(id, 'test-bot', tokenHash);

      const bot = db.getBotByTokenHash(tokenHash);
      expect(bot).toBeDefined();
      if (bot) {
        expect(bot.id).toBe(id);
      }
    });

    it('should return undefined for non-existent bot', () => {
      db = createTestDb();
      const bot = db.getBot('non-existent-id');
      expect(bot).toBeUndefined();
    });

    it('should list all bots', () => {
      db = createTestDb();
      db.addBot('bot-1', 'bot-one', 'hash1', ['tag1']);
      db.addBot('bot-2', 'bot-two', 'hash2');
      db.addBot('bot-3', 'bot-three', 'hash3', ['tag2', 'tag3']);

      const bots = db.listBots();
      expect(bots).toHaveLength(3);
    });

    it('should update bot tags', () => {
      db = createTestDb();
      const id = randomUUID();
      db.addBot(id, 'test-bot', 'hash123', ['old-tag']);

      const updated = db.updateBotTags(id, ['new-tag-1', 'new-tag-2']);
      expect(updated).toBe(true);

      const bot = db.getBot(id);
      expect(bot?.tags).toBe('["new-tag-1","new-tag-2"]');
    });

    it('should clear bot tags', () => {
      db = createTestDb();
      const id = randomUUID();
      db.addBot(id, 'test-bot', 'hash123', ['old-tag']);

      db.updateBotTags(id, null);

      const bot = db.getBot(id);
      expect(bot?.tags).toBeNull();
    });

    it('should delete a bot', () => {
      db = createTestDb();
      const id = randomUUID();
      db.addBot(id, 'test-bot', 'hash123');

      const deleted = db.deleteBot(id);
      expect(deleted).toBe(true);

      const bot = db.getBot(id);
      expect(bot).toBeUndefined();
    });

    it('should return false when deleting non-existent bot', () => {
      db = createTestDb();
      const deleted = db.deleteBot('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should count bots', () => {
      db = createTestDb();
      expect(db.countBots()).toBe(0);

      db.addBot('bot-1', 'bot-one', 'hash1');
      expect(db.countBots()).toBe(1);

      db.addBot('bot-2', 'bot-two', 'hash2');
      expect(db.countBots()).toBe(2);
    });
  });

  describe('Usage Log', () => {
    it('should log usage', () => {
      db = createTestDb();
      const botId = randomUUID();
      db.addBot(botId, 'test-bot', 'hash123');

      // Log usage - this should not throw
      expect(() => {
        db?.logUsage(botId, 'openai', 'key-123', 200);
      }).not.toThrow();
    });

    it('should log usage with null key and status', () => {
      db = createTestDb();
      const botId = randomUUID();
      db.addBot(botId, 'test-bot', 'hash123');

      expect(() => {
        db?.logUsage(botId, 'openai', null, null);
      }).not.toThrow();
    });
  });
});
