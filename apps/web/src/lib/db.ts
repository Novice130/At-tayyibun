import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db-schema';
import * as relations from './db-relations';

const globalForDb = globalThis as unknown as {
  dbPool?: Pool;
  db?: ReturnType<typeof drizzle>;
};

export const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = pool;

export const db =
  globalForDb.db ?? drizzle(pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
