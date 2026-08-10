-- Seed drizzle's migration ledger on a database whose schema already exists.
--
-- Run ONCE per database, before the first automated migration run. The
-- production database was created with `drizzle-kit push` and by hand, so it
-- carries the full schema but no drizzle.__drizzle_migrations table. Pointing
-- the migrator at it in that state replays 0000 — the whole-schema migration —
-- against live tables.
--
-- This records 0000 and 0001 as already applied. The migrator only compares
-- `created_at` against each journal entry's `when`, so what makes it correct is
-- the created_at values; the hashes are recorded so the rows match what the
-- migrator itself would have written.
--
--   hash       = sha256 of the migration file's contents
--   created_at = the `when` field of that entry in drizzle/meta/_journal.json
--
-- The hashes cover the files as stored with LF endings, which the repository
-- root .gitattributes now pins — a CRLF checkout would hash differently.
--
-- Verify before running (psql "$DATABASE_URL"):
--   select to_regclass('drizzle.__drizzle_migrations');
-- A non-null result means this database is already bootstrapped: stop, and
-- check the rows below against what is there rather than inserting again.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- Refuse to double-seed: this fails the transaction if any row already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations") THEN
    RAISE EXCEPTION 'drizzle.__drizzle_migrations is not empty — already bootstrapped';
  END IF;
END
$$;

INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES
  -- 0000_ambitious_absorbing_man
  ('eab3f7c851dce5986281c294c1ddf71a159d2b07f08b2b7a0806cfbd99d76920', 1776474848379),
  -- 0001_partial_pending_request_index (applied by hand on 2026-08-10)
  ('c46bd1872336c5406ad0a0388cc51694baf533e1f6afe595f88de4d76ca9cf5c', 1786331713344);

COMMIT;

-- Expected afterwards: two rows, the newest created_at 1786331713344.
--   select hash, created_at from drizzle.__drizzle_migrations order by created_at;
