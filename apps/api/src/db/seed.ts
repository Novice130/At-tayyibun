import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { randomUUID } from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { nanoid } from 'nanoid';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';
import { Gender, MembershipTier, Role } from '../common/types/role';

neonConfig.webSocketConstructor = ws;

interface SeedProfile {
  firstName: string;
  lastName: string;
  age: number;
  gender: Gender;
  ethnicity: string;
  city: string;
  state: string;
  bio: string;
  tier: MembershipTier;
}

const maleProfiles: SeedProfile[] = [
  { firstName: 'Ahmad', lastName: 'Rahman', age: 28, gender: 'MALE', ethnicity: 'South Asian', city: 'New York', state: 'NY', bio: 'Software engineer who loves hiking and reading Quran in the mornings.', tier: 'GOLD' },
  { firstName: 'Yusuf', lastName: 'Al-Farsi', age: 31, gender: 'MALE', ethnicity: 'Arab', city: 'Houston', state: 'TX', bio: 'Doctor completing residency in cardiology.', tier: 'SILVER' },
  { firstName: 'Omar', lastName: 'Diallo', age: 26, gender: 'MALE', ethnicity: 'African', city: 'Atlanta', state: 'GA', bio: 'Business owner running a halal food chain.', tier: 'FREE' },
  { firstName: 'Ibrahim', lastName: 'Kaya', age: 33, gender: 'MALE', ethnicity: 'Turkish', city: 'Chicago', state: 'IL', bio: 'Civil engineer with a love for architecture and Islamic art.', tier: 'GOLD' },
  { firstName: 'Hassan', lastName: 'Mirza', age: 29, gender: 'MALE', ethnicity: 'Persian', city: 'Los Angeles', state: 'CA', bio: 'Graphic designer and part-time Islamic calligraphy artist.', tier: 'SILVER' },
  { firstName: 'Bilal', lastName: 'Osman', age: 35, gender: 'MALE', ethnicity: 'African American', city: 'Philadelphia', state: 'PA', bio: 'Teacher at an Islamic school.', tier: 'FREE' },
  { firstName: 'Tariq', lastName: 'Hussain', age: 27, gender: 'MALE', ethnicity: 'South Asian', city: 'Dallas', state: 'TX', bio: 'Accountant and weekend martial arts instructor.', tier: 'FREE' },
  { firstName: 'Khalid', lastName: 'Nasser', age: 30, gender: 'MALE', ethnicity: 'Arab', city: 'Detroit', state: 'MI', bio: 'Pharmacist running a family pharmacy.', tier: 'SILVER' },
  { firstName: 'Hamza', lastName: 'Wijaya', age: 25, gender: 'MALE', ethnicity: 'Southeast Asian', city: 'San Francisco', state: 'CA', bio: 'Data scientist at a tech startup.', tier: 'FREE' },
  { firstName: 'Faisal', lastName: 'Ahmed', age: 32, gender: 'MALE', ethnicity: 'South Asian', city: 'Boston', state: 'MA', bio: 'Dentist with a passion for community health.', tier: 'GOLD' },
];

const femaleProfiles: SeedProfile[] = [
  { firstName: 'Fatima', lastName: 'Zahra', age: 25, gender: 'FEMALE', ethnicity: 'Arab', city: 'New York', state: 'NY', bio: 'Medical student with a love for poetry and Islamic history.', tier: 'GOLD' },
  { firstName: 'Aisha', lastName: 'Patel', age: 27, gender: 'FEMALE', ethnicity: 'South Asian', city: 'Chicago', state: 'IL', bio: 'Lawyer focused on civil rights.', tier: 'SILVER' },
  { firstName: 'Khadija', lastName: 'Toure', age: 24, gender: 'FEMALE', ethnicity: 'African', city: 'Houston', state: 'TX', bio: 'Pharmacist and Quran teacher on weekends.', tier: 'FREE' },
  { firstName: 'Maryam', lastName: 'Yilmaz', age: 29, gender: 'FEMALE', ethnicity: 'Turkish', city: 'Los Angeles', state: 'CA', bio: 'Interior designer blending modern aesthetics with Islamic geometry.', tier: 'GOLD' },
  { firstName: 'Noor', lastName: 'Rezaei', age: 26, gender: 'FEMALE', ethnicity: 'Persian', city: 'Seattle', state: 'WA', bio: 'Software engineer who loves hiking in the Pacific Northwest.', tier: 'SILVER' },
  { firstName: 'Layla', lastName: 'Washington', age: 28, gender: 'FEMALE', ethnicity: 'African American', city: 'Atlanta', state: 'GA', bio: 'Pediatric nurse and community organizer.', tier: 'FREE' },
  { firstName: 'Sara', lastName: 'Khan', age: 23, gender: 'FEMALE', ethnicity: 'South Asian', city: 'Dallas', state: 'TX', bio: 'Recent grad in biomedical engineering.', tier: 'FREE' },
  { firstName: 'Amina', lastName: 'Hassan', age: 30, gender: 'FEMALE', ethnicity: 'Arab', city: 'Detroit', state: 'MI', bio: 'High school math teacher and weekend hiker.', tier: 'SILVER' },
  { firstName: 'Yasmin', lastName: 'Putri', age: 26, gender: 'FEMALE', ethnicity: 'Southeast Asian', city: 'San Francisco', state: 'CA', bio: 'UX designer with a passion for accessible tech.', tier: 'FREE' },
  { firstName: 'Sumaya', lastName: 'Ali', age: 31, gender: 'FEMALE', ethnicity: 'African', city: 'Minneapolis', state: 'MN', bio: 'Nonprofit director working with refugee communities.', tier: 'GOLD' },
];

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });

  console.log('Starting seed...');
  console.log('Clearing existing data...');

  await db.delete(schema.infoRequests);
  await db.delete(schema.skipReasons);
  await db.delete(schema.messages);
  await db.delete(schema.profiles);
  await db.delete(schema.photos);
  await db.delete(schema.session);
  await db.delete(schema.account);
  await db.delete(schema.users);

  const password = await hashPassword('Test@123');

  const allProfiles = [...maleProfiles, ...femaleProfiles];
  console.log(`Creating ${allProfiles.length} profiles...`);

  for (let i = 0; i < allProfiles.length; i++) {
    const p = allProfiles[i];
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - p.age);
    const userId = randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.users).values({
      id: userId,
      publicId: nanoid(12),
      email: `${p.firstName.toLowerCase()}${i}@example.com`,
      phone: generatePhoneNumber(),
      passwordHash: password,
      role: Role.USER,
      membershipTier: p.tier,
      isVerified: true,
      isPhoneVerified: true,
      emailVerified: true,
      emailVerifiedAt: now,
      updatedAt: now,
    });

    await db.insert(schema.profiles).values({
      id: randomUUID(),
      userId,
      firstName: p.firstName,
      lastNameEnc: '',
      dob: dob.toISOString().slice(0, 10),
      gender: p.gender,
      ethnicity: p.ethnicity,
      city: p.city,
      state: p.state,
      bioEnc: '',
      publicFields: { bio: p.bio },
      profileComplete: true,
      updatedAt: now,
    });

    process.stdout.write(`\r  Created ${i + 1}/${allProfiles.length} profiles...`);
  }

  console.log(
    `\nSeed completed! Created ${allProfiles.length} profiles (${maleProfiles.length} male, ${femaleProfiles.length} female)`,
  );
  console.log('Password for all test accounts: Test@123');
  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
