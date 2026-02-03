import { readFileSync } from 'fs';

function readSecret(envVar: string, filePath?: string): string {
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8').trim();
    } catch {
      // Fall through to env var
    }
  }
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Missing required config: ${envVar} or file ${filePath}`);
  }
  return value;
}

export interface Config {
  adminPort: number;
  dataPort: number;
  dbPath: string;
  masterKey: Buffer;
  adminToken: string;
}

export function loadConfig(): Config {
  const masterKeyHex = readSecret('MASTER_KEY', process.env.MASTER_KEY_FILE);
  const masterKey = Buffer.from(masterKeyHex, 'hex');

  if (masterKey.length !== 32) {
    throw new Error('MASTER_KEY must be 32 bytes (64 hex chars) for AES-256');
  }

  return {
    adminPort: parseInt(process.env.ADMIN_PORT ?? '9100', 10),
    dataPort: parseInt(process.env.DATA_PORT ?? '9101', 10),
    dbPath: process.env.DB_PATH ?? './proxy.db',
    masterKey,
    adminToken: readSecret('ADMIN_TOKEN', process.env.ADMIN_TOKEN_FILE),
  };
}
