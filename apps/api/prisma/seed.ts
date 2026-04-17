import { PrismaClient, Gender, MembershipTier, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

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
  {
    firstName: 'Ahmad',
    lastName: 'Rahman',
    age: 28,
    gender: 'MALE',
    ethnicity: 'South Asian',
    city: 'New York',
    state: 'NY',
    bio: 'Software engineer who loves hiking and reading Quran in the mornings. Looking for a partner who values deen and family.',
    tier: 'GOLD',
  },
  {
    firstName: 'Yusuf',
    lastName: 'Al-Farsi',
    age: 31,
    gender: 'MALE',
    ethnicity: 'Arab',
    city: 'Houston',
    state: 'TX',
    bio: 'Doctor completing residency in cardiology. Passionate about community service and volunteering at the local masjid.',
    tier: 'SILVER',
  },
  {
    firstName: 'Omar',
    lastName: 'Diallo',
    age: 26,
    gender: 'MALE',
    ethnicity: 'African',
    city: 'Atlanta',
    state: 'GA',
    bio: 'Business owner running a halal food chain. I enjoy cooking, traveling, and spending quality time with family.',
    tier: 'FREE',
  },
  {
    firstName: 'Ibrahim',
    lastName: 'Kaya',
    age: 33,
    gender: 'MALE',
    ethnicity: 'Turkish',
    city: 'Chicago',
    state: 'IL',
    bio: 'Civil engineer with a love for architecture and Islamic art. Seeking someone who appreciates both tradition and growth.',
    tier: 'GOLD',
  },
  {
    firstName: 'Hassan',
    lastName: 'Mirza',
    age: 29,
    gender: 'MALE',
    ethnicity: 'Persian',
    city: 'Los Angeles',
    state: 'CA',
    bio: 'Graphic designer and part-time Islamic calligraphy artist. I believe in living a balanced life of deen and creativity.',
    tier: 'SILVER',
  },
  {
    firstName: 'Bilal',
    lastName: 'Osman',
    age: 35,
    gender: 'MALE',
    ethnicity: 'African American',
    city: 'Philadelphia',
    state: 'PA',
    bio: 'Teacher at an Islamic school. Dedicated to nurturing young minds and building a strong Muslim community. Family-oriented.',
    tier: 'FREE',
  },
  {
    firstName: 'Tariq',
    lastName: 'Hussain',
    age: 27,
    gender: 'MALE',
    ethnicity: 'South Asian',
    city: 'Dallas',
    state: 'TX',
    bio: 'Accountant and weekend martial arts instructor. Looking for a practicing Muslimah who values honesty and laughter.',
    tier: 'FREE',
  },
  {
    firstName: 'Khalid',
    lastName: 'Nasser',
    age: 30,
    gender: 'MALE',
    ethnicity: 'Arab',
    city: 'Detroit',
    state: 'MI',
    bio: 'Pharmacist running a family pharmacy. Active in the local masjid youth programs. I value kindness and patience.',
    tier: 'SILVER',
  },
  {
    firstName: 'Hamza',
    lastName: 'Wijaya',
    age: 25,
    gender: 'MALE',
    ethnicity: 'Southeast Asian',
    city: 'San Francisco',
    state: 'CA',
    bio: 'Data scientist at a tech startup. Love outdoor adventures, reading seerah, and learning new languages.',
    tier: 'FREE',
  },
  {
    firstName: 'Faisal',
    lastName: 'Ahmed',
    age: 32,
    gender: 'MALE',
    ethnicity: 'South Asian',
    city: 'Boston',
    state: 'MA',
    bio: 'Dentist with a passion for community health. I enjoy long walks, board games, and Friday halaqas.',
    tier: 'GOLD',
  },
];

const femaleProfiles: SeedProfile[] = [
  {
    firstName: 'Fatima',
    lastName: 'Zahra',
    age: 25,
    gender: 'FEMALE',
    ethnicity: 'Arab',
    city: 'New York',
    state: 'NY',
    bio: 'Medical student with a love for poetry and Islamic history. Looking for someone who values education and spiritual growth.',
    tier: 'GOLD',
  },
  {
    firstName: 'Aisha',
    lastName: 'Patel',
    age: 27,
    gender: 'FEMALE',
    ethnicity: 'South Asian',
    city: 'Chicago',
    state: 'IL',
    bio: 'Lawyer focused on civil rights. Passionate about social justice and community empowerment. Family is everything to me.',
    tier: 'SILVER',
  },
  {
    firstName: 'Khadija',
    lastName: 'Toure',
    age: 24,
    gender: 'FEMALE',
    ethnicity: 'African',
    city: 'Houston',
    state: 'TX',
    bio: 'Pharmacist and Quran teacher on weekends. I love gardening, baking, and spending time with my nieces and nephews.',
    tier: 'FREE',
  },
  {
    firstName: 'Maryam',
    lastName: 'Yilmaz',
    age: 29,
    gender: 'FEMALE',
    ethnicity: 'Turkish',
    city: 'Los Angeles',
    state: 'CA',
    bio: 'Interior designer who blends modern aesthetics with Islamic geometric patterns. Seeking a partner with ambition and taqwa.',
    tier: 'GOLD',
  },
  {
    firstName: 'Noor',
    lastName: 'Rezaei',
    age: 26,
    gender: 'FEMALE',
    ethnicity: 'Persian',
    city: 'Seattle',
    state: 'WA',
    bio: 'Software engineer who loves hiking in the Pacific Northwest. I value deep conversations, chai, and consistent prayer.',
    tier: 'SILVER',
  },
  {
    firstName: 'Layla',
    lastName: 'Washington',
    age: 28,
    gender: 'FEMALE',
    ethnicity: 'African American',
    city: 'Atlanta',
    state: 'GA',
    bio: 'Pediatric nurse and community organizer. My faith is my anchor. Looking for someone kind, patient, and family-oriented.',
    tier: 'FREE',
  },
  {
    firstName: 'Sara',
    lastName: 'Khan',
    age: 23,
    gender: 'FEMALE',
    ethnicity: 'South Asian',
    city: 'Dallas',
    state: 'TX',
    bio: 'Recent grad in biomedical engineering. I enjoy reading, volunteering, and trying new halal restaurants around the city.',
    tier: 'FREE',
  },
  {
    firstName: 'Amina',
    lastName: 'Hassan',
    age: 30,
    gender: 'FEMALE',
    ethnicity: 'Arab',
    city: 'Detroit',
    state: 'MI',
    bio: 'High school math teacher and weekend hiker. I believe in building a home filled with laughter, love, and Quran.',
    tier: 'SILVER',
  },
  {
    firstName: 'Yasmin',
    lastName: 'Putri',
    age: 26,
    gender: 'FEMALE',
    ethnicity: 'Southeast Asian',
    city: 'San Francisco',
    state: 'CA',
    bio: 'UX designer with a passion for accessible tech. Love calligraphy, cooking traditional recipes, and morning walks.',
    tier: 'FREE',
  },
  {
    firstName: 'Sumaya',
    lastName: 'Ali',
    age: 31,
    gender: 'FEMALE',
    ethnicity: 'African',
    city: 'Minneapolis',
    state: 'MN',
    bio: 'Nonprofit director working with refugee communities. Looking for a supportive partner who shares my passion for service.',
    tier: 'GOLD',
  },
];

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

async function main() {
  console.log('Starting seed...');

  // Clear existing data (order matters for foreign keys)
  console.log('Clearing existing data...');
  await prisma.infoRequest.deleteMany();
  await prisma.skipReason.deleteMany();
  await prisma.message.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const password = await argon2.hash('Test@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const allProfiles = [...maleProfiles, ...femaleProfiles];
  console.log(`Creating ${allProfiles.length} profiles...`);

  for (let i = 0; i < allProfiles.length; i++) {
    const p = allProfiles[i];
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - p.age);

    await prisma.user.create({
      data: {
        publicId: nanoid(12),
        email: `${p.firstName.toLowerCase()}${i}@example.com`,
        phone: generatePhoneNumber(),
        passwordHash: password,
        role: Role.USER,
        membershipTier: p.tier,
        isVerified: true,
        isPhoneVerified: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: p.firstName,
            lastNameEnc: '', // Would be encrypted in production
            dob,
            gender: p.gender,
            ethnicity: p.ethnicity,
            city: p.city,
            state: p.state,
            bioEnc: '',
            publicFields: { bio: p.bio },
            profileComplete: true,
          },
        },
      },
    });
    process.stdout.write(`\r  Created ${i + 1}/${allProfiles.length} profiles...`);
  }

  console.log(`\nSeed completed! Created ${allProfiles.length} profiles (${maleProfiles.length} male, ${femaleProfiles.length} female)`);
  console.log('Password for all test accounts: Test@123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
