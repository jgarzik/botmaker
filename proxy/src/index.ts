import Fastify from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import { loadConfig } from './config.js';
import { ProxyDatabase } from './db/index.js';
import { KeyringService } from './services/keyring.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerProxyRoutes } from './routes/proxy.js';

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize database
  const db = new ProxyDatabase(config.dbPath);

  // Initialize keyring service
  const keyring = new KeyringService(db, config.masterKey);

  // Create admin server
  const adminApp = Fastify({ logger: true });
  await adminApp.register(fastifyHelmet);
  await adminApp.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  adminApp.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
  registerAdminRoutes(adminApp, db, config.masterKey, config.adminToken);

  // Create data plane server
  const dataApp = Fastify({ logger: true });
  await dataApp.register(fastifyHelmet);
  await dataApp.register(fastifyRateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // Parse JSON and raw bodies for proxy
  dataApp.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_, body, done) => {
      done(null, body);
    }
  );
  dataApp.addContentTypeParser(
    '*',
    { parseAs: 'buffer' },
    (_, body, done) => {
      done(null, body);
    }
  );

  registerProxyRoutes(dataApp, db, keyring);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    await adminApp.close();
    await dataApp.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // Start servers
  try {
    await adminApp.listen({ port: config.adminPort, host: '0.0.0.0' });
    console.log(`Admin API listening on port ${config.adminPort}`);

    await dataApp.listen({ port: config.dataPort, host: '0.0.0.0' });
    console.log(`Data plane listening on port ${config.dataPort}`);
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

void main();
