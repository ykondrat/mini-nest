import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Application } from '../src/dispatcher';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { createPool } from '../src/database/database';
import { DATABASE_POOL } from '../src/tokens';

const dbConfigured = Boolean(process.env.PGHOST);

test(
  'users are read from Postgres through the DI-injected pool',
  { skip: dbConfigured ? false : 'set PGHOST (or use docker compose) to run the DB test' },
  async () => {
    const pool = createPool();

    try {
      const app = new Application(
        [UsersController],
        [{ provide: DATABASE_POOL, useValue: pool }, UsersService],
      );
      const { port, close } = await app.listen(0);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/users?limit=10`);

        assert.equal(res.status, 200);

        const users = (await res.json()) as Array<{ id: number; email: string }>;

        assert.ok(Array.isArray(users));
        assert.ok(users.length >= 1, 'seeded users should be present');
        assert.ok(users[0].email.includes('@'));
      } finally {
        await close();
      }
    } finally {
      await pool.end();
    }
  },
);