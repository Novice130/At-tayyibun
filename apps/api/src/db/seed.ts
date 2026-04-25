import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { randomUUID, createCipheriv } from 'crypto';
import * as crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { nanoid } from 'nanoid';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';
import { Gender, MembershipTier, Role } from '../common/types/role';

neonConfig.webSocketConstructor = ws;

// Inline AES-256-GCM encryption matching EncryptionService
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return Buffer.from(key, 'hex');
}

function encrypt(plaintext: string): string {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function encryptJson(data: object): string {
  return encrypt(JSON.stringify(data));
}

interface Biodata {
  hideLocation: boolean;
  legalStatus: string;
  education: string;
  profession: string;
  relocate: string;
  religiousPractice: string;
  prayerFrequency: string;
  dietaryPreference: string;
  sect?: string;
  partnerPreferences: string;
  dealBreakers?: string;
}

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
  biodata: Biodata;
}

const maleProfiles: SeedProfile[] = [
  {
    firstName: 'Ahmad', lastName: 'Rahman', age: 28, gender: 'MALE',
    ethnicity: 'South Asian', city: 'New York', state: 'NY', tier: 'GOLD',
    bio: 'Software engineer who loves hiking and reading Quran in the mornings. Looking for a partner who values deen above all.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Software Engineer',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Looking for a practicing Muslimah who is kind, family-oriented, and values both deen and education. Preferably someone who wears hijab.',
      dealBreakers: 'Non-practicing, smoking, unwilling to raise children Islamically',
    },
  },
  {
    firstName: 'Yusuf', lastName: 'Al-Farsi', age: 31, gender: 'MALE',
    ethnicity: 'Arab', city: 'Houston', state: 'TX', tier: 'SILVER',
    bio: 'Doctor completing residency in cardiology. Passionate about serving my community through medicine and volunteering at the local masjid.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Doctoral Degree (MD)',
      profession: 'Cardiologist (Resident)',
      relocate: 'No',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Educated, kind-hearted sister who understands the demands of a medical career and shares Islamic values. Hijab preferred but not required.',
      dealBreakers: 'Unwillingness to have children, excessive materialism',
    },
  },
  {
    firstName: 'Omar', lastName: 'Diallo', age: 26, gender: 'MALE',
    ethnicity: 'African', city: 'Atlanta', state: 'GA', tier: 'FREE',
    bio: 'Business owner running a halal food chain across Georgia. Community-driven and always looking to give back to the ummah.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Permanent Resident',
      education: 'Bachelor\'s Degree',
      profession: 'Business Owner',
      relocate: 'No',
      religiousPractice: 'Striving',
      prayerFrequency: 'Most prayers',
      dietaryPreference: 'Halal',
      partnerPreferences: 'A grounded sister who appreciates entrepreneurship, family values, and is actively working on her deen. Open to any ethnicity.',
      dealBreakers: 'Disinterest in family life, distance from Islam',
    },
  },
  {
    firstName: 'Ibrahim', lastName: 'Kaya', age: 33, gender: 'MALE',
    ethnicity: 'Turkish', city: 'Chicago', state: 'IL', tier: 'GOLD',
    bio: 'Civil engineer with a love for architecture and Islamic art. I spend weekends at the Chicago Islamic architecture society.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Master\'s Degree',
      profession: 'Civil Engineer',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni (Hanafi)',
      partnerPreferences: 'Intellectual, cultured Muslimah who appreciates art and history. Someone who values a quiet, purposeful life over social media and trends.',
      dealBreakers: 'Lack of ambition, not interested in family',
    },
  },
  {
    firstName: 'Hassan', lastName: 'Mirza', age: 29, gender: 'MALE',
    ethnicity: 'Persian', city: 'Los Angeles', state: 'CA', tier: 'SILVER',
    bio: 'Graphic designer and part-time Islamic calligraphy artist. I find peace in art and dhikr.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Graphic Designer',
      relocate: 'Yes',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Halal',
      sect: 'Sunni',
      partnerPreferences: 'Creative, spiritually grounded sister. Doesn\'t need to be in the same field but should appreciate art and culture. Someone warm and family-oriented.',
      dealBreakers: 'Smoking, clubbing, careless about halal',
    },
  },
  {
    firstName: 'Bilal', lastName: 'Osman', age: 35, gender: 'MALE',
    ethnicity: 'African American', city: 'Philadelphia', state: 'PA', tier: 'FREE',
    bio: 'Teacher at an Islamic school for 8 years. I believe education and tarbiyah of children is one of the most noble callings in Islam.',
    biodata: {
      hideLocation: true,
      legalStatus: 'Citizen',
      education: 'Master\'s Degree',
      profession: 'Islamic School Teacher',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Someone who wants to raise a righteous family together. A sister who is nurturing, patient, and sees raising children as an act of ibadah.',
      dealBreakers: 'Not wanting children, disrespect for Islamic education',
    },
  },
  {
    firstName: 'Tariq', lastName: 'Hussain', age: 27, gender: 'MALE',
    ethnicity: 'South Asian', city: 'Dallas', state: 'TX', tier: 'FREE',
    bio: 'Accountant by day, martial arts instructor on weekends. Discipline and balance are my core values.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Accountant',
      relocate: 'Open',
      religiousPractice: 'Striving',
      prayerFrequency: 'Most prayers',
      dietaryPreference: 'Halal',
      partnerPreferences: 'Active, health-conscious sister who has a positive outlook on life. Doesn\'t need to be sporty but should support a healthy lifestyle.',
      dealBreakers: 'Excessive negativity, no desire for self-improvement',
    },
  },
  {
    firstName: 'Khalid', lastName: 'Nasser', age: 30, gender: 'MALE',
    ethnicity: 'Arab', city: 'Detroit', state: 'MI', tier: 'SILVER',
    bio: 'Pharmacist running a family-owned pharmacy. Close to my family and look forward to building my own household.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Doctoral Degree (PharmD)',
      profession: 'Pharmacist',
      relocate: 'No',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Family-oriented sister who values close ties with in-laws and wants a warm home. Ideally educated and has career goals too.',
      dealBreakers: 'Unwilling to have family involved, disrespect toward elders',
    },
  },
  {
    firstName: 'Hamza', lastName: 'Wijaya', age: 25, gender: 'MALE',
    ethnicity: 'Southeast Asian', city: 'San Francisco', state: 'CA', tier: 'FREE',
    bio: 'Data scientist at a tech startup. I love reading, hiking, and exploring new halal restaurants.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Visa-Holder',
      education: 'Master\'s Degree',
      profession: 'Data Scientist',
      relocate: 'Yes',
      religiousPractice: 'Striving',
      prayerFrequency: 'Most prayers',
      dietaryPreference: 'Halal',
      sect: 'Sunni',
      partnerPreferences: 'Curious, open-minded sister who loves exploring ideas. Someone who is kind and wants to grow in deen together.',
      dealBreakers: 'Closed-mindedness, no interest in personal growth',
    },
  },
  {
    firstName: 'Faisal', lastName: 'Ahmed', age: 32, gender: 'MALE',
    ethnicity: 'South Asian', city: 'Boston', state: 'MA', tier: 'GOLD',
    bio: 'Dentist with a passion for community health. I run free dental clinics for underserved communities monthly.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Doctoral Degree (DMD)',
      profession: 'Dentist',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'A compassionate, service-minded sister who shares a passion for giving back. Educated and values both worldly achievement and akhirah.',
      dealBreakers: 'Materialism without purpose, indifference to social responsibility',
    },
  },
];

const femaleProfiles: SeedProfile[] = [
  {
    firstName: 'Fatima', lastName: 'Zahra', age: 25, gender: 'FEMALE',
    ethnicity: 'Arab', city: 'New York', state: 'NY', tier: 'GOLD',
    bio: 'Medical student with a love for poetry and Islamic history. I find that the more I learn, the more my faith deepens.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Doctoral Degree (MD in progress)',
      profession: 'Medical Student',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Seeking a practicing, ambitious brother who is secure and supportive. Must respect my career and share Islamic values. Good sense of humour a plus.',
      dealBreakers: 'Controlling behavior, disrespect for women\'s education, smoking',
    },
  },
  {
    firstName: 'Aisha', lastName: 'Patel', age: 27, gender: 'FEMALE',
    ethnicity: 'South Asian', city: 'Chicago', state: 'IL', tier: 'SILVER',
    bio: 'Lawyer focused on civil rights and immigration law. I am deeply passionate about justice as a Quranic value.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Doctoral Degree (JD)',
      profession: 'Civil Rights Lawyer',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Confident, emotionally mature brother who supports a working wife. Intellectual conversations and shared values are important to me.',
      dealBreakers: 'Dismissiveness toward women\'s careers, tribalism, lack of empathy',
    },
  },
  {
    firstName: 'Khadija', lastName: 'Toure', age: 24, gender: 'FEMALE',
    ethnicity: 'African', city: 'Houston', state: 'TX', tier: 'FREE',
    bio: 'Pharmacist and Quran teacher on weekends. Teaching the Book of Allah is the most fulfilling part of my week.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Permanent Resident',
      education: 'Doctoral Degree (PharmD)',
      profession: 'Pharmacist & Quran Teacher',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni (Maliki)',
      partnerPreferences: 'A brother who loves the Quran and wants to build a home where the deen is lived, not just spoken. Kind, patient, and family-oriented.',
      dealBreakers: 'Lack of connection to Quran and sunnah, not wanting children',
    },
  },
  {
    firstName: 'Maryam', lastName: 'Yilmaz', age: 29, gender: 'FEMALE',
    ethnicity: 'Turkish', city: 'Los Angeles', state: 'CA', tier: 'GOLD',
    bio: 'Interior designer blending modern aesthetics with Islamic geometry. Every space I design is inspired by the divine order.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Master\'s Degree',
      profession: 'Interior Designer',
      relocate: 'Yes',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Halal',
      sect: 'Sunni (Hanafi)',
      partnerPreferences: 'Creative, cultured brother with an appreciation for art and beauty. Stable, kind, and wants to build a home that is both a sanctuary and a place of worship.',
      dealBreakers: 'Disinterest in culture and aesthetics, harshness',
    },
  },
  {
    firstName: 'Noor', lastName: 'Rezaei', age: 26, gender: 'FEMALE',
    ethnicity: 'Persian', city: 'Seattle', state: 'WA', tier: 'SILVER',
    bio: 'Software engineer who loves hiking in the Pacific Northwest. I balance my technical career with a grounded spiritual life.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Software Engineer',
      relocate: 'Open',
      religiousPractice: 'Striving',
      prayerFrequency: 'Most prayers',
      dietaryPreference: 'Halal',
      partnerPreferences: 'Easygoing, adventurous brother who loves the outdoors and is serious about growing in deen. Someone who doesn\'t take himself too seriously but is intentional about life.',
      dealBreakers: 'Rigid thinking, unsupportive of wife\'s career',
    },
  },
  {
    firstName: 'Layla', lastName: 'Washington', age: 28, gender: 'FEMALE',
    ethnicity: 'African American', city: 'Atlanta', state: 'GA', tier: 'FREE',
    bio: 'Pediatric nurse and community organizer. I converted to Islam 5 years ago and have never looked back.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Pediatric Nurse',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      partnerPreferences: 'A grounded Muslim brother who is welcoming to reverts and understands the unique journey of someone who came to Islam as an adult. Patience and warmth are key.',
      dealBreakers: 'Bias against converts, cultural superiority, lack of compassion',
    },
  },
  {
    firstName: 'Sara', lastName: 'Khan', age: 23, gender: 'FEMALE',
    ethnicity: 'South Asian', city: 'Dallas', state: 'TX', tier: 'FREE',
    bio: 'Recent grad in biomedical engineering. I am at the beginning of my career but clear on my values and goals.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Bachelor\'s Degree',
      profession: 'Biomedical Engineer (Junior)',
      relocate: 'Yes',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Looking for a kind, practicing brother who is mature and ready for marriage. Someone who will be a partner in both deen and dunya.',
      dealBreakers: 'Not ready for commitment, pressuring family involvement prematurely',
    },
  },
  {
    firstName: 'Amina', lastName: 'Hassan', age: 30, gender: 'FEMALE',
    ethnicity: 'Arab', city: 'Detroit', state: 'MI', tier: 'SILVER',
    bio: 'High school math teacher and weekend hiker. I love simplicity, honesty, and long conversations over tea.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Master\'s Degree',
      profession: 'High School Math Teacher',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'Honest, straightforward brother who values simple living. Must be family-oriented and have a sense of humor. Not looking for flash — looking for substance.',
      dealBreakers: 'Dishonesty, arrogance, too much focus on appearances',
    },
  },
  {
    firstName: 'Yasmin', lastName: 'Putri', age: 26, gender: 'FEMALE',
    ethnicity: 'Southeast Asian', city: 'San Francisco', state: 'CA', tier: 'FREE',
    bio: 'UX designer with a passion for accessible technology. I believe tech should serve humanity and be designed with empathy.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Visa-Holder',
      education: 'Bachelor\'s Degree',
      profession: 'UX Designer',
      relocate: 'Yes',
      religiousPractice: 'Striving',
      prayerFrequency: 'Most prayers',
      dietaryPreference: 'Halal',
      sect: 'Sunni (Shafi\'i)',
      partnerPreferences: 'Open-minded, empathetic brother who appreciates design thinking and wants to build something meaningful together. Someone who is curious about the world.',
      dealBreakers: 'Closed-mindedness, not valuing education or growth',
    },
  },
  {
    firstName: 'Sumaya', lastName: 'Ali', age: 31, gender: 'FEMALE',
    ethnicity: 'African', city: 'Minneapolis', state: 'MN', tier: 'GOLD',
    bio: 'Nonprofit director working with refugee communities for the past 6 years. Service is central to my identity.',
    biodata: {
      hideLocation: false,
      legalStatus: 'Citizen',
      education: 'Master\'s Degree',
      profession: 'Nonprofit Director',
      relocate: 'Open',
      religiousPractice: 'Practicing',
      prayerFrequency: 'All 5 prayers daily',
      dietaryPreference: 'Zabiha',
      sect: 'Sunni',
      partnerPreferences: 'A compassionate, service-minded brother who cares about the ummah. Looking for a life partner who sees marriage as a team effort for this life and the next.',
      dealBreakers: 'Indifference to social issues, unwillingness to serve community',
    },
  },
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

    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.profiles).values({
      id: randomUUID(),
      userId,
      firstName: p.firstName,
      lastNameEnc: encrypt(p.lastName),
      dob: dob.toISOString().slice(0, 10),
      gender: p.gender,
      ethnicity: p.ethnicity,
      city: p.biodata.hideLocation ? null : p.city,
      state: p.state,
      bioEnc: encrypt(p.bio),
      biodataJsonEnc: encryptJson(p.biodata),
      publicFields: { bio: p.bio.substring(0, 200) },
      profileComplete: true,
      updatedAt: now,
    });

    process.stdout.write(`\r  Created ${i + 1}/${allProfiles.length} profiles...`);
  }

  console.log(`\nSeed complete — ${allProfiles.length} profiles (${maleProfiles.length} male, ${femaleProfiles.length} female)`);
  console.log('\nTest accounts (password: Test@123)');
  console.log('--- Male ---');
  maleProfiles.forEach((p, i) => console.log(`  ${p.firstName.toLowerCase()}${i}@example.com  (${p.firstName} ${p.lastName}, ${p.age}, ${p.ethnicity}, ${p.tier})`));
  console.log('--- Female ---');
  femaleProfiles.forEach((p, i) => console.log(`  ${p.firstName.toLowerCase()}${i + 10}@example.com  (${p.firstName} ${p.lastName}, ${p.age}, ${p.ethnicity}, ${p.tier})`));

  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
