/**
 * Photo Seed Script
 * Run: pnpm --filter @at-tayyibun/api exec ts-node -r tsconfig-paths/register src/db/seed-photos.ts
 *
 * Seeds mock AI_AVATAR data for testing the photo moderation queue.
 */
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { randomUUID } from 'crypto';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

neonConfig.webSocketConstructor = ws;

// A very small base64 pixel (placeholder)
const TINY_AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });

  console.log('Photo seed starting...');

  // 1. Get some users
  const users = await db.select().from(schema.users).limit(5);
  
  if (users.length === 0) {
    console.log('! No users found. Run pnpm db:seed first.');
    await pool.end();
    return;
  }

  console.log(`Found ${users.length} users. Creating avatars...`);

  for (const user of users) {
    const photoId = randomUUID();
    
    // Check if user already has a pending avatar to avoid duplicates
    const [existing] = await db.select()
      .from(schema.photos)
      .where(eq(schema.photos.userId, user.id))
      .limit(1);

    if (existing) {
      console.log(`- User ${user.email} already has a photo.`);
      continue;
    }

    await db.insert(schema.photos).values({
      id: photoId,
      userId: user.id,
      type: 'AI_AVATAR',
      dataUri: TINY_AVATAR,
      isPrimary: true,
      adminApproved: false, // Keep it pending for moderation test
      visibility: 'PRIVATE',
      createdAt: new Date().toISOString(),
    });

    console.log(`✓ Created AI_AVATAR for ${user.email}`);
  }

  console.log('Photo seed completed!');
  await pool.end();
}

// Helper eq import since we used it
import { eq } from 'drizzle-orm';

main().catch((e) => {
  console.error('Photo seed failed:', e);
  process.exit(1);
});
