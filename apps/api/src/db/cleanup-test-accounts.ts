/**
 * Clean Test Accounts Script
 * Run: npx tsx src/db/cleanup-test-accounts.ts
 *
 * Deletes all non-admin user accounts from the database,
 * keeping only accounts with role = 'SUPER_ADMIN' or role = 'ADMIN'
 * or email matching ADMIN_EMAIL.
 */
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { notInArray, and, ne, eq } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

neonConfig.webSocketConstructor = ws;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@attayyibun.com';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('REPLACE_AFTER_ROTATION')) {
    console.error('DATABASE_URL is not set or contains placeholder.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool, { schema: { ...schema, ...relations } });

  console.log('Cleaning test accounts...');

  // Identify non-admin accounts
  const nonAdminUsers = await db
    .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
    .from(schema.users)
    .where(
      and(
        ne(schema.users.email, ADMIN_EMAIL),
        notInArray(schema.users.role, ['SUPER_ADMIN', 'ADMIN'])
      )
    );

  console.log(`Found ${nonAdminUsers.length} test user account(s) to delete.`);

  if (nonAdminUsers.length === 0) {
    console.log('No test accounts to delete. Admin accounts preserved.');
    await pool.end();
    return;
  }

  const userIdsToDelete = nonAdminUsers.map((u) => u.id);

  // Delete related records that may not cascade
  for (const userId of userIdsToDelete) {
    await db.delete(schema.session).where(eq(schema.session.userId, userId));
    await db.delete(schema.account).where(eq(schema.account.userId, userId));
    await db.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }

  console.log(`✓ Successfully deleted ${nonAdminUsers.length} test account(s).`);
  console.log(`✓ Admin account preserved: ${ADMIN_EMAIL}`);

  await pool.end();
}

main().catch((e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});
