import net from 'net';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db-schema';

if (typeof (net as any).setDefaultAutoSelectFamily === 'function') {
  (net as any).setDefaultAutoSelectFamily(false);
}

const globalForDb = globalThis as unknown as {
  dbPool?: Pool;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const rawDbUrl = process.env.DATABASE_URL?.replace(/^["']|["']$/g, '').trim();

if (!rawDbUrl || rawDbUrl.includes('REPLACE_AFTER_ROTATION')) {
  console.error(
    '[db] CRITICAL ERROR: DATABASE_URL is not set or contains REPLACE_AFTER_ROTATION! Neon DB queries will fail.',
  );
}

export const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString: rawDbUrl,
    // Verify TLS certificates; never disable — it defeats the purpose of TLS.
    ssl: { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = pool;

export const db =
  globalForDb.db ?? drizzle(pool, { schema, casing: 'snake_case' });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
