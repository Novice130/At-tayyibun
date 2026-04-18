/**
 * Admin Account Seed Script
 * Run: npx ts-node prisma/seed-admin.ts
 * 
 * Creates or promotes admin@attayyibun.com to SUPER_ADMIN role.
 * Safe to re-run — upserts by email.
 */
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
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
    if (existing.role === Role.SUPER_ADMIN) {
      console.log(`✓ ${ADMIN_EMAIL} already has role: SUPER_ADMIN`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: Role.SUPER_ADMIN },
      });
      console.log(`✓ Promoted ${ADMIN_EMAIL} (${existing.role} → SUPER_ADMIN)`);
    }
    console.log(`  Public ID: ${existing.publicId}`);
    console.log(`  User ID:   ${existing.id}`);
    return;
  }

  // Create new admin user (better-auth uses scrypt; must match for login to work)
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      publicId: nanoid(12),
      email: ADMIN_EMAIL,
      name: 'Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
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
