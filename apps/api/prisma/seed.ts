import { PrismaClient, Gender, MembershipTier, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// First names by gender
const maleNames = [
  'Ahmad', 'Yusuf', 'Omar', 'Ali', 'Ibrahim', 'Hassan', 'Hussein', 'Khalid',
  'Mohammed', 'Tariq', 'Bilal', 'Hamza', 'Mustafa', 'Rashid', 'Salim', 'Karim',
  'Faisal', 'Jamal', 'Nasser', 'Samir', 'Waleed', 'Zaid', 'Kareem', 'Malik', 'Adam'
];

const femaleNames = [
  'Fatima', 'Aisha', 'Khadija', 'Zainab', 'Maryam', 'Noor', 'Layla', 'Sara',
  'Hana', 'Leila', 'Amina', 'Yasmin', 'Sumaya', 'Rania', 'Dina', 'Salma',
  'Hafsa', 'Ruqayya', 'Zahra', 'Safiya', 'Iman', 'Halima', 'Mariam', 'Asma', 'Nawal'
];

const ethnicities = ['South Asian', 'Arab', 'African', 'Persian', 'Turkish', 'Southeast Asian', 'Caucasian', 'African American'];

const cities = [
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Detroit', state: 'MI' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Miami', state: 'FL' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Boston', state: 'MA' },
  { city: 'Minneapolis', state: 'MN' },
];

const tiers: MembershipTier[] = ['FREE', 'SILVER', 'GOLD'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAge(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing profiles and users...');
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  const password = await argon2.hash('Test@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  console.log('👤 Creating 50 profiles...');

  // Create 25 male profiles
  for (let i = 0; i < 25; i++) {
    const firstName = maleNames[i];
    const location = randomElement(cities);
    const age = randomAge(23, 40);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - age);

    await prisma.user.create({
      data: {
        publicId: nanoid(12),
        email: `${firstName.toLowerCase()}${i}@example.com`,
        phone: generatePhoneNumber(),
        passwordHash: password,
        role: Role.USER,
        membershipTier: randomElement(tiers),
        isVerified: true,
        isPhoneVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName,
            lastNameEnc: '',
            dob,
            gender: Gender.MALE,
            ethnicity: randomElement(ethnicities),
            city: location.city,
            state: location.state,
            bioEnc: '',
            profileComplete: true,
          },
        },
      },
    });
    process.stdout.write(`\r  Created ${i + 1}/50 profiles...`);
  }

  // Create 25 female profiles
  for (let i = 0; i < 25; i++) {
    const firstName = femaleNames[i];
    const location = randomElement(cities);
    const age = randomAge(21, 35);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - age);

    await prisma.user.create({
      data: {
        publicId: nanoid(12),
        email: `${firstName.toLowerCase()}${i}@example.com`,
        phone: generatePhoneNumber(),
        passwordHash: password,
        role: Role.USER,
        membershipTier: randomElement(tiers),
        isVerified: true,
        isPhoneVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName,
            lastNameEnc: '',
            dob,
            gender: Gender.FEMALE,
            ethnicity: randomElement(ethnicities),
            city: location.city,
            state: location.state,
            bioEnc: '',
            profileComplete: true,
          },
        },
      },
    });
    process.stdout.write(`\r  Created ${25 + i + 1}/50 profiles...`);
  }

  console.log('\n✅ Seed completed! Created 50 profiles (25 male, 25 female)');
  console.log('   Password for all test accounts: Test@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
