/**
 * Admin Account Seed Script
 * Run: pnpm --filter @at-tayyibun/api seed:admin
 *
 * Creates or promotes admin@attayyibun.com to SUPER_ADMIN role.
 * Safe to re-run — upserts by email.
 */
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { nanoid } from 'nanoid';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

neonConfig.webSocketConstructor = ws;

const ADMIN_EMAIL = 'admin@attayyibun.com';
const ADMIN_PASSWORD = 'ChitapataChinukulu';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { ...schema, ...relations } });

  console.log('Admin seed starting...');

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const now = new Date().toISOString();

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, ADMIN_EMAIL)).limit(1);

  if (existing) {
    console.log(`✓ ${ADMIN_EMAIL} already exists. Updating role and password...`);
    await db.update(schema.users)
      .set({ 
        role: 'SUPER_ADMIN',
        passwordHash,
        updatedAt: now
      })
      .where(eq(schema.users.id, existing.id));

    // Also update the account table if it exists
    await db.update(schema.account)
      .set({ 
        password: passwordHash,
        updatedAt: now
      })
      .where(eq(schema.account.userId, existing.id));

    console.log(`✓ Updated roles and credentials for ${ADMIN_EMAIL}`);
    await pool.end();
    return;
  }

  const userId = randomUUID();

  await db.insert(schema.users).values({
    id: userId,
    publicId: nanoid(12),
    email: ADMIN_EMAIL,
    name: 'Admin',
    passwordHash,
    role: 'SUPER_ADMIN',
    isVerified: true,
    emailVerified: true,
    emailVerifiedAt: now,
    updatedAt: now,
  });

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✓ Created admin account: ${ADMIN_EMAIL}`);
  console.log(`  Public ID: ${nanoid(12)}`);
  console.log(`  User ID:   ${userId}`);
  console.log(`  Role:      SUPER_ADMIN`);

  await pool.end();
}

main().catch((e) => {
  console.error('Admin seed failed:', e);
  process.exit(1);
});
