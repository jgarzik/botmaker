import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { runMigrations } from './migrations.js';

describe('Database Migrations', () => {
  let testDir: string;
  let db: Database.Database;

  beforeEach(() => {
    testDir = join(tmpdir(), `migrations-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    const dbPath = join(testDir, 'test.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  function createBaseSchema(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL UNIQUE,
        ai_provider TEXT NOT NULL,
        model TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        container_id TEXT,
        status TEXT NOT NULL DEFAULT 'created',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  function getColumns(tableName: string): string[] {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    return columns.map(c => c.name);
  }

  function getMigrationVersion(): number {
    const row = db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null };
    return row.version ?? -1;
  }

  describe('fresh database', () => {
    it('should create migrations table', () => {
      createBaseSchema();
      runMigrations(db);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      expect(tables.map(t => t.name)).toContain('migrations');
    });

    it('should apply all migrations', () => {
      createBaseSchema();
      runMigrations(db);

      const version = getMigrationVersion();
      expect(version).toBe(4); // v0, v1, v2, v3, v4
    });

    it('should add port column (v1)', () => {
      createBaseSchema();
      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('port');
    });

    it('should add gateway_token column (v2)', () => {
      createBaseSchema();
      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('gateway_token');
    });

    it('should add tags column (v3)', () => {
      createBaseSchema();
      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('tags');
    });
  });

  describe('idempotent re-run', () => {
    it('should not fail when run multiple times', () => {
      createBaseSchema();

      // Run migrations multiple times
      runMigrations(db);
      runMigrations(db);
      runMigrations(db);

      const version = getMigrationVersion();
      expect(version).toBe(4);
    });

    it('should not duplicate migration records', () => {
      createBaseSchema();
      runMigrations(db);
      runMigrations(db);

      const count = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number };
      expect(count.count).toBe(5); // v0, v1, v2, v3, v4
    });
  });

  describe('partial migration state', () => {
    it('should continue from v0', () => {
      createBaseSchema();

      // Simulate v0 already applied
      db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(0, new Date().toISOString());

      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('port');
      expect(columns).toContain('gateway_token');
      expect(columns).toContain('tags');
    });

    it('should continue from v1', () => {
      createBaseSchema();
      db.exec('ALTER TABLE bots ADD COLUMN port INTEGER');

      db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(0, new Date().toISOString());
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());

      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('gateway_token');
      expect(columns).toContain('tags');
    });

    it('should continue from v2', () => {
      createBaseSchema();
      db.exec('ALTER TABLE bots ADD COLUMN port INTEGER');
      db.exec('ALTER TABLE bots ADD COLUMN gateway_token TEXT');

      db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(0, new Date().toISOString());
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(2, new Date().toISOString());

      runMigrations(db);

      const columns = getColumns('bots');
      expect(columns).toContain('tags');

      const version = getMigrationVersion();
      expect(version).toBe(4);
    });
  });
});
