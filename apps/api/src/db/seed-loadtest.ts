/**
 * Fills a load-test database with fake profiles, and writes the Locust account
 * pool. See loadtest/RUNBOOK.md.
 *
 *   SEED_ALLOWED_HOST=<db host> DATABASE_URL=... BETTER_AUTH_SECRET=... \
 *     ENCRYPTION_KEY=... pnpm --filter @at-tayyibun/api db:seed:loadtest
 *
 * Deliberately does not load any .env file: every value must be given on the
 * command line, so a stray file cannot point this at a real database. Refuses
 * unless the DATABASE_URL host equals SEED_ALLOWED_HOST exactly, and unless the
 * database holds few real users. Re-running adds nothing and renews the pool's
 * sessions. It never deletes anything.
 */
import { closeSync, existsSync, fchmodSync, openSync, readFileSync, writeSync } from 'fs';
import { resolve } from 'path';
import { hashPassword } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray, not, like, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import {
  assertSeedTarget,
  encrypt,
  refuseIfRealData,
  seedCounts,
  seedPerson,
  sessionCookie,
  sessionToken,
} from './seed-loadtest.lib';

const BATCH = 500;
const SESSION_DAYS = 30;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`seed refused: ${name} is not set`);
  return value;
}

function poolFilePath(): string {
  return process.env.LOADTEST_POOL_FILE || resolve(__dirname, '../../../../loadtest/accounts.jsonl');
}

/** Replaces this script's lines and keeps any others, so SignUp's accounts survive. */
function writePoolFile(entries: { email: string }[]): void {
  const path = poolFilePath();
  const fresh = new Set(entries.map((e) => e.email));
  const kept = existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim() && !fresh.has(JSON.parse(line).email))
    : [];
  const fd = openSync(path, 'w', 0o600);
  fchmodSync(fd, 0o600);
  writeSync(fd, [...kept, ...entries.map((e) => JSON.stringify(e))].join('\n') + '\n');
  closeSync(fd);
}

async function main() {
  const connectionString = assertSeedTarget(process.env);
  const { profiles: profileCount, accounts: accountCount } = seedCounts(process.env);
  const authSecret = required('BETTER_AUTH_SECRET');
  const encryptionKey = required('ENCRYPTION_KEY');

  const pool = new Pool({ connectionString, max: 4 });
  const db = drizzle(pool, { schema });
  try {
    const [real] = await db
      .select({ value: sql<number>`COUNT(*)` })
      .from(schema.users)
      .where(not(like(schema.users.email, '%.invalid')));
    refuseIfRealData(Number(real.value));

    // Optional: without it the accounts have sessions but cannot sign in by password.
    const passwordHash = process.env.SEED_PASSWORD ? await hashPassword(process.env.SEED_PASSWORD) : null;
    const now = new Date().toISOString();

    for (let start = 0; start < profileCount; start += BATCH) {
      const people = Array.from(
        { length: Math.min(BATCH, profileCount - start) },
        (_, i) => ({ index: start + i, ...seedPerson(start + i) }),
      );

      await db
        .insert(schema.users)
        .values(
          people.map((p) => ({
            id: p.id,
            publicId: p.publicId,
            email: p.email,
            phone: p.phone,
            name: p.firstName,
            role: 'USER' as const,
            membershipTier: p.tier,
            isVerified: true,
            isPhoneVerified: true,
            emailVerified: true,
            emailVerifiedAt: now,
            termsAcceptedAt: now,
            passwordHash: p.index < accountCount ? passwordHash : null,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing();

      // A row can be skipped if a SignUp run already took its phone number, so
      // only give profiles to the users that really exist.
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(inArray(schema.users.id, people.map((p) => p.id)));
      const existingIds = new Set(existing.map((row) => row.id));
      const present = people.filter((p) => existingIds.has(p.id));

      await db
        .insert(schema.profiles)
        .values(
          present.map((p) => ({
            id: p.profileId,
            userId: p.id,
            firstName: p.firstName,
            lastNameEnc: encrypt(p.lastName, encryptionKey),
            dob: p.dob,
            gender: p.gender,
            ethnicity: p.ethnicity,
            city: p.city,
            state: p.state,
            bioEnc: encrypt(p.bio, encryptionKey),
            biodataJsonEnc: encrypt(JSON.stringify(p.biodata), encryptionKey),
            publicFields: { bio: p.bio.substring(0, 200) },
            maritalStatus: p.maritalStatus,
            hasChildren: p.hasChildren,
            childrenCount: p.childrenCount,
            openToDivorced: p.openToDivorced,
            openToWidowed: p.openToWidowed,
            openToChildren: p.openToChildren,
            profileComplete: true,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing();

      process.stdout.write(`\r  ${start + people.length}/${profileCount} profiles`);
    }
    process.stdout.write('\n');

    // The first accountCount people are the Locust pool: a session and a cookie each.
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    const entries: { email: string }[] = [];
    for (let index = 0; index < accountCount; index++) {
      const p = seedPerson(index);
      const token = sessionToken(index, authSecret);
      await db
        .insert(schema.session)
        .values({
          id: p.profileId,
          userId: p.id,
          token,
          expiresAt,
          updatedAt: now,
          userAgent: 'loadtest-seed',
        })
        // token too: it derives from BETTER_AUTH_SECRET, which may have been rotated.
        .onConflictDoUpdate({ target: schema.session.id, set: { token, expiresAt, updatedAt: now } });

      if (passwordHash) {
        await db
          .insert(schema.account)
          .values({
            id: p.id,
            accountId: p.id,
            providerId: 'credential',
            userId: p.id,
            password: passwordHash,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }

      entries.push({
        email: p.email,
        gender: p.gender,
        publicId: p.publicId,
        phone: p.phone,
        cookie: sessionCookie(token, authSecret),
        maritalStatus: p.maritalStatus,
        hasChildren: p.hasChildren,
        openToDivorced: p.openToDivorced,
        openToWidowed: p.openToWidowed,
        openToChildren: p.openToChildren,
      } as { email: string });
    }
    writePoolFile(entries);
    console.log(`Done: ${profileCount} profiles, ${accountCount} pool accounts. Pool file written, mode 600.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  // Never the error object: a driver error can echo the connection details.
  console.error(e instanceof Error && e.message.startsWith('seed refused') ? e.message : `Seed failed: ${e?.code ?? e?.name ?? 'unknown'}`);
  process.exit(1);
});
