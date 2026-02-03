import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID, randomBytes } from 'crypto';
import { ProxyDatabase } from '../db/index.js';
import { KeyringService } from './keyring.js';
import { encrypt } from '../crypto/encryption.js';

describe('KeyringService', () => {
  let testDir: string;
  let db: ProxyDatabase;
  let masterKey: Buffer;
  let keyring: KeyringService;

  beforeEach(() => {
    testDir = join(tmpdir(), `keyring-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    // Copy schema to test dir
    const srcSchemaPath = join(import.meta.dirname, '../db/schema.sql');
    const destSchemaPath = join(testDir, 'schema.sql');
    writeFileSync(destSchemaPath, readFileSync(srcSchemaPath, 'utf-8'));

    const dbPath = join(testDir, 'test.db');
    db = new ProxyDatabase(dbPath);
    masterKey = randomBytes(32);
    keyring = new KeyringService(db, masterKey);
  });

  afterEach(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  function addTestKey(vendor: string, secret: string, tag?: string): string {
    const id = randomUUID();
    const encrypted = encrypt(secret, masterKey);
    db.addKey(id, vendor, encrypted, undefined, tag);
    return id;
  }

  describe('selectKey', () => {
    it('should select a key for vendor', () => {
      addTestKey('openai', 'sk-test-123');

      const result = keyring.selectKey('openai');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('sk-test-123');
      }
    });

    it('should return null for vendor with no keys', () => {
      const result = keyring.selectKey('openai');
      expect(result).toBeNull();
    });

    it('should round-robin between keys', () => {
      addTestKey('openai', 'key-1');
      addTestKey('openai', 'key-2');
      addTestKey('openai', 'key-3');

      const results = [];
      for (let i = 0; i < 6; i++) {
        const selection = keyring.selectKey('openai');
        if (selection) {
          results.push(selection.secret);
        }
      }

      // Should cycle through all keys
      expect(results).toContain('key-1');
      expect(results).toContain('key-2');
      expect(results).toContain('key-3');

      // Should repeat the pattern
      expect(results[0]).toBe(results[3]);
      expect(results[1]).toBe(results[4]);
      expect(results[2]).toBe(results[5]);
    });
  });

  describe('selectKeyForBot', () => {
    it('should select tagged key when bot has matching tag', () => {
      addTestKey('openai', 'default-key');
      addTestKey('openai', 'prod-key', 'prod');

      const result = keyring.selectKeyForBot('openai', ['prod']);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('prod-key');
      }
    });

    it('should try tags in order', () => {
      addTestKey('openai', 'default-key');
      addTestKey('openai', 'dev-key', 'dev');
      addTestKey('openai', 'prod-key', 'prod');

      // First tag match wins
      const result = keyring.selectKeyForBot('openai', ['prod', 'dev']);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('prod-key');
      }
    });

    it('should fallback to untagged keys when no tag match', () => {
      addTestKey('openai', 'default-key');
      addTestKey('openai', 'prod-key', 'prod');

      const result = keyring.selectKeyForBot('openai', ['staging']); // No matching tag

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('default-key');
      }
    });

    it('should fallback to any key when no untagged keys', () => {
      addTestKey('openai', 'prod-key', 'prod');

      const result = keyring.selectKeyForBot('openai', ['staging']); // No match

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('prod-key');
      }
    });

    it('should use default keys when bot has no tags', () => {
      addTestKey('openai', 'default-key');
      addTestKey('openai', 'prod-key', 'prod');

      const result = keyring.selectKeyForBot('openai', null);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('default-key');
      }
    });

    it('should use default keys when bot has empty tags', () => {
      addTestKey('openai', 'default-key');
      addTestKey('openai', 'prod-key', 'prod');

      const result = keyring.selectKeyForBot('openai', []);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.secret).toBe('default-key');
      }
    });

    it('should return null when no keys exist', () => {
      const result = keyring.selectKeyForBot('openai', ['prod']);
      expect(result).toBeNull();
    });

    it('should round-robin within tagged keys', () => {
      addTestKey('openai', 'prod-key-1', 'prod');
      addTestKey('openai', 'prod-key-2', 'prod');
      addTestKey('openai', 'prod-key-3', 'prod');

      const results = [];
      for (let i = 0; i < 6; i++) {
        const selection = keyring.selectKeyForBot('openai', ['prod']);
        if (selection) {
          results.push(selection.secret);
        }
      }

      // Should have all three keys
      expect(results.filter(r => r === 'prod-key-1')).toHaveLength(2);
      expect(results.filter(r => r === 'prod-key-2')).toHaveLength(2);
      expect(results.filter(r => r === 'prod-key-3')).toHaveLength(2);
    });

    it('should use separate round-robin counters for different tags', () => {
      addTestKey('openai', 'prod-1', 'prod');
      addTestKey('openai', 'prod-2', 'prod');
      addTestKey('openai', 'dev-1', 'dev');
      addTestKey('openai', 'dev-2', 'dev');

      // Advance prod counter
      keyring.selectKeyForBot('openai', ['prod']);
      keyring.selectKeyForBot('openai', ['prod']);

      // Dev should start fresh
      const devResult = keyring.selectKeyForBot('openai', ['dev']);

      // Both should be consistent in their rotation
      expect(devResult?.secret).toBe('dev-1');
    });

    it('should handle multiple vendors correctly', () => {
      addTestKey('openai', 'openai-key', 'prod');
      addTestKey('anthropic', 'anthropic-key', 'prod');

      const openaiResult = keyring.selectKeyForBot('openai', ['prod']);
      const anthropicResult = keyring.selectKeyForBot('anthropic', ['prod']);

      expect(openaiResult?.secret).toBe('openai-key');
      expect(anthropicResult?.secret).toBe('anthropic-key');
    });
  });
});
