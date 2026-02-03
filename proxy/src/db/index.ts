import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ProviderKey, Bot } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProxyDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    this.db.exec(schema);
  }

  // Provider Keys
  addKey(id: string, vendor: string, secretEncrypted: Buffer, label?: string, tag?: string): void {
    this.db.prepare(`
      INSERT INTO provider_keys (id, vendor, secret_encrypted, label, tag)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, vendor, secretEncrypted, label ?? null, tag ?? null);
  }

  getKey(id: string): ProviderKey | undefined {
    return this.db.prepare(`
      SELECT id, vendor, secret_encrypted, label, tag, created_at
      FROM provider_keys WHERE id = ?
    `).get(id) as ProviderKey | undefined;
  }

  getKeysByVendor(vendor: string): ProviderKey[] {
    return this.db.prepare(`
      SELECT id, vendor, secret_encrypted, label, tag, created_at
      FROM provider_keys WHERE vendor = ?
    `).all(vendor) as ProviderKey[];
  }

  getKeysByVendorAndTag(vendor: string, tag: string): ProviderKey[] {
    return this.db.prepare(`
      SELECT id, vendor, secret_encrypted, label, tag, created_at
      FROM provider_keys WHERE vendor = ? AND tag = ?
    `).all(vendor, tag) as ProviderKey[];
  }

  getDefaultKeysForVendor(vendor: string): ProviderKey[] {
    return this.db.prepare(`
      SELECT id, vendor, secret_encrypted, label, tag, created_at
      FROM provider_keys WHERE vendor = ? AND tag IS NULL
    `).all(vendor) as ProviderKey[];
  }

  listKeys(): { id: string; vendor: string; label: string | null; tag: string | null; created_at: number }[] {
    return this.db.prepare(`
      SELECT id, vendor, label, tag, created_at FROM provider_keys ORDER BY created_at DESC
    `).all() as { id: string; vendor: string; label: string | null; tag: string | null; created_at: number }[];
  }

  deleteKey(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM provider_keys WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  countKeys(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM provider_keys`).get() as { count: number };
    return row.count;
  }

  // Bots
  addBot(id: string, hostname: string, tokenHash: string, tags?: string[]): void {
    const tagsJson = tags && tags.length > 0 ? JSON.stringify(tags) : null;
    this.db.prepare(`
      INSERT INTO bots (id, hostname, token_hash, tags)
      VALUES (?, ?, ?, ?)
    `).run(id, hostname, tokenHash, tagsJson);
  }

  updateBotTags(id: string, tags: string[] | null): boolean {
    const tagsJson = tags && tags.length > 0 ? JSON.stringify(tags) : null;
    const result = this.db.prepare(`UPDATE bots SET tags = ? WHERE id = ?`).run(tagsJson, id);
    return result.changes > 0;
  }

  getBot(id: string): Bot | undefined {
    return this.db.prepare(`
      SELECT id, hostname, token_hash, tags, created_at
      FROM bots WHERE id = ?
    `).get(id) as Bot | undefined;
  }

  getBotByTokenHash(tokenHash: string): Bot | undefined {
    return this.db.prepare(`
      SELECT id, hostname, token_hash, tags, created_at
      FROM bots WHERE token_hash = ?
    `).get(tokenHash) as Bot | undefined;
  }

  listBots(): { id: string; hostname: string; tags: string | null }[] {
    return this.db.prepare(`
      SELECT id, hostname, tags FROM bots ORDER BY created_at DESC
    `).all() as { id: string; hostname: string; tags: string | null }[];
  }

  deleteBot(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM bots WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  countBots(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM bots`).get() as { count: number };
    return row.count;
  }

  // Usage Log
  logUsage(botId: string, vendor: string, keyId: string | null, statusCode: number | null): void {
    this.db.prepare(`
      INSERT INTO usage_log (bot_id, vendor, key_id, status_code)
      VALUES (?, ?, ?, ?)
    `).run(botId, vendor, keyId, statusCode);
  }

  close(): void {
    this.db.close();
  }
}
