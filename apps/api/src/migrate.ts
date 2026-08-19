/**
 * Apply pending Drizzle migrations, then exit.
 *
 * Runs as a separate process before the API starts (see Dockerfile.api), so a
 * failed migration stops the release instead of leaving a new build talking to
 * an old schema. Until this existed there was no migration step in the deploy
 * at all and every migration was applied by hand.
 *
 * Uses drizzle-orm's own migrator rather than drizzle-kit: drizzle-kit is a
 * devDependency and is pruned out of the runner image, while drizzle-orm and
 * pg are production dependencies already.
 *
 * The migrator decides what to apply by comparing each journal entry's `when`
 * against the newest `created_at` in drizzle.__drizzle_migrations. That table
 * did not exist on the production database, so an unprepared run would have
 * replayed 0000 against a live schema — see scripts/bootstrap-migrations.sql,
 * which seeds the ledger with 0000 and 0001 marked applied. Run that once, per
 * database, before this script.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// dist/src/migrate.js → the drizzle/ folder copied next to dist in the image,
// and apps/api/drizzle when run from a local build.
const MIGRATIONS_FOLDER =
  process.env.MIGRATIONS_FOLDER ?? resolve(__dirname, '../../drizzle');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // Refuse to run against a database that has never been bootstrapped. The
  // migrator would create the ledger empty and then treat 0000 — the initial
  // whole-schema migration — as pending.
  const pool = new Pool({
    connectionString: url,
    // Verify TLS certificates; never disable — it defeats the purpose of TLS.
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const { rows } = await pool.query<{ exists: boolean }>(
      `select to_regclass('drizzle.__drizzle_migrations') is not null as exists`,
    );
    if (!rows[0]?.exists) {
      const journal = JSON.parse(
        readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8'),
      ) as { entries: { tag: string }[] };
      throw new Error(
        'drizzle.__drizzle_migrations does not exist on this database. ' +
          'Running the migrator now would replay every migration from ' +
          `${journal.entries[0]?.tag} against the existing schema. Apply ` +
          'apps/api/scripts/bootstrap-migrations.sql first.',
      );
    }

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('[migrate] up to date');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
