import { Pool } from 'pg';

export function createPool(): Pool {
  return new Pool({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'appuser',
    password: process.env.PGPASSWORD ?? 'apppass',
    database: process.env.PGDATABASE ?? 'appdb',
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });
}
