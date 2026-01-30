/**
 * Secrets Manager
 *
 * Per-bot credential isolation with Unix file permissions.
 * Each bot gets its own directory (0700) and secret files (0600).
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** UUID regex for bot ID validation - prevents directory traversal attacks */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the root directory for secrets storage.
 * Uses SECRETS_DIR environment variable if set, otherwise './secrets'.
 */
export function getSecretsRoot(): string {
  return process.env.SECRETS_DIR || './secrets';
}

/**
 * Validates a bot ID is a valid UUID format.
 * This is CRITICAL for security - prevents directory traversal attacks
 * (e.g., bot IDs like "../../etc/passwd" would be rejected).
 *
 * @throws Error if botId is not a valid UUID
 */
export function validateBotId(botId: string): void {
  if (!UUID_REGEX.test(botId)) {
    throw new Error(`Invalid bot ID format: ${botId}`);
  }
}

/**
 * Creates a secrets directory for a specific bot.
 * Directory is created with mode 0700 (owner read/write/execute only).
 *
 * @param botId - UUID of the bot
 * @returns Path to the created directory
 * @throws Error if botId is invalid
 */
export function createBotSecretsDir(botId: string): string {
  validateBotId(botId);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, botId);

  mkdirSync(botDir, { mode: 0o700, recursive: true });

  return botDir;
}

/**
 * Writes a secret file for a bot.
 * File is written with mode 0600 (owner read/write only).
 * Creates the bot's secrets directory if it doesn't exist.
 *
 * @param botId - UUID of the bot
 * @param name - Name of the secret (becomes filename)
 * @param value - Secret value to store
 * @throws Error if botId is invalid
 */
export function writeSecret(botId: string, name: string, value: string): void {
  validateBotId(botId);

  // Ensure bot directory exists
  const botDir = createBotSecretsDir(botId);
  const filePath = join(botDir, name);

  writeFileSync(filePath, value, { mode: 0o600 });
}

/**
 * Reads a secret file for a bot.
 *
 * @param botId - UUID of the bot
 * @param name - Name of the secret to read
 * @returns The secret value (trimmed) or undefined if not found
 * @throws Error if botId is invalid or on non-ENOENT errors
 */
export function readSecret(botId: string, name: string): string | undefined {
  validateBotId(botId);

  const secretsRoot = getSecretsRoot();
  const filePath = join(secretsRoot, botId, name);

  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/**
 * Deletes all secrets for a bot by removing its secrets directory.
 * Safe to call even if the directory doesn't exist.
 *
 * @param botId - UUID of the bot
 * @throws Error if botId is invalid
 */
export function deleteBotSecrets(botId: string): void {
  validateBotId(botId);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, botId);

  rmSync(botDir, { recursive: true, force: true });
}
