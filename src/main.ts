import 'reflect-metadata';

import { Application } from './dispatcher';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { createPool } from './database/database';
import { DATABASE_POOL } from './tokens';

async function bootstrap(): Promise<void> {
  const pool = createPool();
  const app = new Application(
    [UsersController],
    [{ provide: DATABASE_POOL, useValue: pool }, UsersService],
  );

  const port = Number(process.env.PORT ?? '3000');
  const { port: bound, close } = await app.listen(port);

  console.log(`mini-nest (HTTP) listening on http://localhost:${bound}`);

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