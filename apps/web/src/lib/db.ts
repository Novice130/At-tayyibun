import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './db-schema';
import * as relations from './db-relations';

if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForDb = globalThis as unknown as {
  dbPool?: Pool;
  db?: ReturnType<typeof drizzle>;
};

export const pool =
  globalForDb.dbPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = pool;

export const db =
  globalForDb.db ?? drizzle(pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
