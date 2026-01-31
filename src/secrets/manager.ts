/**
 * Secrets Manager
 *
 * Per-bot credential isolation with Unix file permissions.
 * Each bot gets its own directory (0700) and secret files (0600).
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Hostname regex for validation - prevents directory traversal attacks */
const HOSTNAME_REGEX = /^[a-z0-9-]{1,64}$/;

/**
 * Returns the root directory for secrets storage.
 * Uses SECRETS_DIR environment variable if set, otherwise './secrets'.
 */
export function getSecretsRoot(): string {
  return process.env.SECRETS_DIR || './secrets';
}

/**
 * Validates a hostname is a valid DNS-compatible format.
 * This is CRITICAL for security - prevents directory traversal attacks
 * (e.g., hostnames like "../../etc/passwd" would be rejected).
 *
 * @throws Error if hostname is not valid
 */
export function validateHostname(hostname: string): void {
  if (!HOSTNAME_REGEX.test(hostname)) {
    throw new Error(`Invalid hostname format: ${hostname}`);
  }
}

/**
 * Creates a secrets directory for a specific bot.
 * Directory is created with mode 0700 (owner read/write/execute only).
 *
 * @param hostname - Hostname of the bot
 * @returns Path to the created directory
 * @throws Error if hostname is invalid
 */
export function createBotSecretsDir(hostname: string): string {
  validateHostname(hostname);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, hostname);

  mkdirSync(botDir, { mode: 0o700, recursive: true });

  return botDir;
}

/**
 * Writes a secret file for a bot.
 * File is written with mode 0600 (owner read/write only).
 * Creates the bot's secrets directory if it doesn't exist.
 *
 * @param hostname - Hostname of the bot
 * @param name - Name of the secret (becomes filename)
 * @param value - Secret value to store
 * @throws Error if hostname is invalid
 */
export function writeSecret(hostname: string, name: string, value: string): void {
  validateHostname(hostname);

  // Ensure bot directory exists
  const botDir = createBotSecretsDir(hostname);
  const filePath = join(botDir, name);

  writeFileSync(filePath, value, { mode: 0o600 });
}

/**
 * Reads a secret file for a bot.
 *
 * @param hostname - Hostname of the bot
 * @param name - Name of the secret to read
 * @returns The secret value (trimmed) or undefined if not found
 * @throws Error if hostname is invalid or on non-ENOENT errors
 */
export function readSecret(hostname: string, name: string): string | undefined {
  validateHostname(hostname);

  const secretsRoot = getSecretsRoot();
  const filePath = join(secretsRoot, hostname, name);

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
 * @param hostname - Hostname of the bot
 * @throws Error if hostname is invalid
 */
export function deleteBotSecrets(hostname: string): void {
  validateHostname(hostname);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, hostname);

  rmSync(botDir, { recursive: true, force: true });
}
