/**
 * Bot Store
 *
 * CRUD operations for bots using SQLite database.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import type { Bot, BotStatus } from '../types/bot.js';

export interface CreateBotInput {
  name: string;
  hostname: string;
  ai_provider: string;
  model: string;
  channel_type: string;
  port: number;
  gateway_token: string;
}

export interface UpdateBotInput {
  name?: string;
  hostname?: string;
  ai_provider?: string;
  model?: string;
  channel_type?: string;
  container_id?: string | null;
  port?: number | null;
  gateway_token?: string | null;
  status?: BotStatus;
}

/**
 * Create a new bot.
 *
 * @param input - Bot creation data
 * @returns The created bot
 */
export function createBot(input: CreateBotInput): Bot {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO bots (id, name, hostname, ai_provider, model, channel_type, port, gateway_token, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.name, input.hostname, input.ai_provider, input.model, input.channel_type, input.port, input.gateway_token, 'created', now, now);

  return {
    id,
    name: input.name,
    hostname: input.hostname,
    ai_provider: input.ai_provider,
    model: input.model,
    channel_type: input.channel_type,
    container_id: null,
    port: input.port,
    gateway_token: input.gateway_token,
    status: 'created',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a bot by ID.
 *
 * @param id - Bot UUID
 * @returns The bot or null if not found
 */
export function getBot(id: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE id = ?');
  const row = stmt.get(id) as Bot | undefined;
  return row ?? null;
}

/**
 * Get a bot by name.
 *
 * @param name - Bot name
 * @returns The bot or null if not found
 */
export function getBotByName(name: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE name = ?');
  const row = stmt.get(name) as Bot | undefined;
  return row ?? null;
}

/**
 * Get a bot by hostname.
 *
 * @param hostname - Bot hostname (DNS-compatible identifier)
 * @returns The bot or null if not found
 */
export function getBotByHostname(hostname: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE hostname = ?');
  const row = stmt.get(hostname) as Bot | undefined;
  return row ?? null;
}

/**
 * List all bots.
 *
 * @returns Array of all bots
 */
export function listBots(): Bot[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots ORDER BY created_at DESC');
  return stmt.all() as Bot[];
}

/**
 * Update a bot.
 *
 * @param id - Bot UUID
 * @param input - Fields to update
 * @returns The updated bot or null if not found
 */
export function updateBot(id: string, input: UpdateBotInput): Bot | null {
  const db = getDb();
  const now = new Date().toISOString();

  // Build dynamic UPDATE query
  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.hostname !== undefined) {
    updates.push('hostname = ?');
    values.push(input.hostname);
  }
  if (input.ai_provider !== undefined) {
    updates.push('ai_provider = ?');
    values.push(input.ai_provider);
  }
  if (input.model !== undefined) {
    updates.push('model = ?');
    values.push(input.model);
  }
  if (input.channel_type !== undefined) {
    updates.push('channel_type = ?');
    values.push(input.channel_type);
  }
  if (input.container_id !== undefined) {
    updates.push('container_id = ?');
    values.push(input.container_id);
  }
  if (input.port !== undefined) {
    updates.push('port = ?');
    values.push(input.port);
  }
  if (input.gateway_token !== undefined) {
    updates.push('gateway_token = ?');
    values.push(input.gateway_token);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE bots SET ${updates.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getBot(id);
}

/**
 * Delete a bot.
 *
 * @param id - Bot UUID
 * @returns true if deleted, false if not found
 */
export function deleteBot(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM bots WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get the next available port for a bot container.
 * Finds the lowest available port by detecting gaps in used ports.
 *
 * @param startPort - Starting port number
 * @returns Next available port
 */
export function getNextBotPort(startPort: number): number {
  const db = getDb();

  // Get all used ports in ascending order
  const stmt = db.prepare('SELECT port FROM bots WHERE port IS NOT NULL ORDER BY port');
  const rows = stmt.all() as { port: number }[];

  // Find first gap starting from startPort
  let port = startPort;
  for (const row of rows) {
    if (row.port > port) break; // Found gap
    if (row.port === port) port = row.port + 1;
  }

  return port;
}
