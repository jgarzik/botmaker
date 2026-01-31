import type Database from 'better-sqlite3';

/**
 * Create database schema - bots table and indexes.
 * Uses CREATE TABLE IF NOT EXISTS for idempotent initialization.
 */
export function createSchema(db: Database.Database): void {
  // Create bots table
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

  // Create indexes for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_hostname ON bots(hostname)`);
}
