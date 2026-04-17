/**
 * Admin Account Seed Script
 * Run: npx ts-node prisma/seed-admin.ts
 * 
 * Creates or promotes admin@attayyibun.com to ADMIN role.
 * Safe to re-run — upserts by email.
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@attayyibun.com';
const ADMIN_PASSWORD = 'ChitapataChinukulu';

async function main() {
  console.log('Admin seed starting...');

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    // Promote to ADMIN if not already
    if (existing.role === Role.ADMIN || existing.role === Role.SUPER_ADMIN) {
      console.log(`✓ ${ADMIN_EMAIL} already has role: ${existing.role}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: Role.ADMIN },
      });
      console.log(`✓ Promoted ${ADMIN_EMAIL} to ADMIN`);
    }
    console.log(`  Public ID: ${existing.publicId}`);
    console.log(`  User ID:   ${existing.id}`);
    return;
  }

  // Create new admin user
  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.create({
    data: {
      publicId: nanoid(12),
      email: ADMIN_EMAIL,
      name: 'Admin',
      passwordHash,
      role: Role.ADMIN,
      isVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Also create a BetterAuth account entry so login works
  await prisma.account.create({
    data: {
      accountId: admin.id,
      providerId: 'credential',
      userId: admin.id,
      password: passwordHash,
    },
  });

  console.log(`✓ Created admin account: ${ADMIN_EMAIL}`);
  console.log(`  Public ID: ${admin.publicId}`);
  console.log(`  User ID:   ${admin.id}`);
  console.log(`  Role:      ${admin.role}`);
}

main()
  .catch((e) => {
    console.error('Admin seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
