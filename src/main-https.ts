import 'reflect-metadata';

import * as fs from 'node:fs';
import * as path from 'node:path';

import { Application } from './dispatcher';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { createPool } from './database/database';
import { DATABASE_POOL } from './tokens';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.HTTPS_PORT ?? '3443');
  const certDir = path.join(__dirname, '..', '..', 'certs');
  const keyPath = process.env.TLS_KEY ?? path.join(certDir, 'key.pem');
  const certPath = process.env.TLS_CERT ?? path.join(certDir, 'cert.pem');

  let key: Buffer;
  let cert: Buffer;

  try {
    key = fs.readFileSync(keyPath);
    cert = fs.readFileSync(certPath);
  } catch {
    console.error(
      `Missing TLS cert/key (looked for ${certPath} and ${keyPath}).\n` +
        'Generate a self-signed pair first:  npm run certs',
    );
    process.exit(1);
  }

  const pool = createPool();
  const app = new Application(
    [UsersController],
    [{ provide: DATABASE_POOL, useValue: pool }, UsersService],
  );

  const { port: bound, close } = await app.listenTls(port, { key, cert });

  console.log(`mini-nest (HTTPS) listening on https://localhost:${bound}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down`);

    await close();
    await pool.end();

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();