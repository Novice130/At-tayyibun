/**
 * Pure parts of seed-loadtest.ts, kept apart so they can be tested without a
 * database. Everything about a person derives from their index, so a re-run
 * produces the same rows and inserts nothing new.
 */
import { createCipheriv, createHash, createHmac, randomBytes } from 'crypto';

export const EMAIL_DOMAIN = '@loadtest.invalid';
export const MAX_REAL_USERS = 100;

const PRODUCTION_HOSTS = new Set(['attayyibun.com', 'www.attayyibun.com', 'hz-attayyibun.learnnovice.com']);

type Env = Record<string, string | undefined>;

function refuse(reason: string): never {
  throw new Error(`seed refused: ${reason}`);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The connection string to use, or a refusal. There is no default target: the
 * operator must name the exact host, and the message never echoes the URL.
 */
export function assertSeedTarget(env: Env): string {
  const url = env.DATABASE_URL;
  const allowed = env.SEED_ALLOWED_HOST?.trim().toLowerCase();
  if (!url) refuse('DATABASE_URL is not set');
  if (!allowed) refuse('SEED_ALLOWED_HOST is not set');
  const host = hostOf(url);
  if (!host) refuse('DATABASE_URL cannot be parsed');
  if (host !== allowed) refuse('the DATABASE_URL host does not match SEED_ALLOWED_HOST');
  for (const site of [env.WEB_URL, env.BETTER_AUTH_URL]) {
    const siteHost = site ? hostOf(site) : null;
    if (siteHost && PRODUCTION_HOSTS.has(siteHost)) refuse('this environment names the production site');
  }
  return url;
}

/** A load-test database has few real members; production has many. */
export function refuseIfRealData(realUserCount: number): void {
  if (realUserCount > MAX_REAL_USERS) {
    refuse(`the database has ${realUserCount} users without .invalid emails (limit ${MAX_REAL_USERS})`);
  }
}

export function seedCounts(env: Env): { profiles: number; accounts: number } {
  const profiles = Number(env.SEED_PROFILES ?? 5000);
  const accounts = Number(env.SEED_ACCOUNTS ?? 250);
  if (!Number.isInteger(profiles) || profiles < 5000 || profiles > 10000) {
    refuse('SEED_PROFILES must be a whole number from 5000 to 10000');
  }
  if (!Number.isInteger(accounts) || accounts < 250 || accounts > profiles) {
    refuse('SEED_ACCOUNTS must be a whole number from 250 up to SEED_PROFILES');
  }
  return { profiles, accounts };
}

const MALE_NAMES = ['Ahmad', 'Yusuf', 'Omar', 'Ibrahim', 'Hassan', 'Bilal', 'Tariq', 'Khalid', 'Hamza', 'Zayd', 'Idris', 'Mustafa', 'Salman', 'Anas', 'Imran', 'Faisal', 'Kareem', 'Nabil', 'Rashid', 'Sami', 'Adil', 'Jamal', 'Malik', 'Younes', 'Haroon', 'Usman', 'Ismail', 'Dawud', 'Sulaiman', 'Harith'];
const FEMALE_NAMES = ['Aisha', 'Fatima', 'Maryam', 'Khadija', 'Zainab', 'Sumayya', 'Hafsa', 'Amina', 'Layla', 'Noor', 'Safiya', 'Ruqayya', 'Hajar', 'Asma', 'Yasmin', 'Samira', 'Huda', 'Salma', 'Iman', 'Rania', 'Dina', 'Lubna', 'Mariam', 'Nadia', 'Sana', 'Tasnim', 'Zahra', 'Bushra', 'Aaliyah', 'Inaya'];
const LAST_NAMES = ['Rahman', 'Al-Farsi', 'Diallo', 'Kaya', 'Mirza', 'Osman', 'Hussain', 'Nasser', 'Siddiqui', 'Khan', 'Ahmed', 'Ali', 'Haddad', 'Mansour', 'Bah', 'Sesay', 'Yilmaz', 'Demir', 'Tehrani', 'Karimi', 'Qureshi', 'Chaudhry', 'Saleh', 'Hamdan', 'Abdullah', 'Sharif', 'Malik', 'Aziz', 'Iqbal', 'Barre'];
const ETHNICITIES = ['South Asian', 'Arab', 'African', 'African American', 'Turkish', 'Persian', 'Southeast Asian', 'Convert'];
const PLACES: [string, string][] = [['New York', 'NY'], ['Houston', 'TX'], ['Atlanta', 'GA'], ['Chicago', 'IL'], ['Los Angeles', 'CA'], ['Philadelphia', 'PA'], ['Dallas', 'TX'], ['Detroit', 'MI'], ['Dearborn', 'MI'], ['Seattle', 'WA'], ['Minneapolis', 'MN'], ['Boston', 'MA'], ['Phoenix', 'AZ'], ['San Jose', 'CA'], ['Orlando', 'FL'], ['Columbus', 'OH'], ['Charlotte', 'NC'], ['Denver', 'CO'], ['Paterson', 'NJ'], ['Fairfax', 'VA']];
const PROFESSIONS = ['Software Engineer', 'Pharmacist', 'Teacher', 'Accountant', 'Nurse', 'Civil Engineer', 'Physician', 'Graphic Designer', 'Business Owner', 'Researcher', 'Dentist', 'Project Manager', 'Paralegal', 'Social Worker', 'Data Analyst'];
const EDUCATION = ["Bachelor's Degree", "Master's Degree", 'Doctoral Degree', 'Associate Degree', 'Trade Certificate'];
const PRACTICE = ['Practicing', 'Striving', 'Very Practicing'];
const PRAYER = ['All 5 prayers daily', 'Most prayers', 'Working on it'];
const BIO_OPENERS = ['Close to my family and grateful for my deen.', 'Quiet at home, active in the community.', 'I volunteer at the local masjid most weekends.', 'Early riser who loves a long walk after Fajr.', 'Learning Arabic slowly and enjoying every lesson.'];
const BIO_MIDDLES = ['I work hard but make time for the people I love.', 'Reading, cooking and travel fill most of my free time.', 'I value honesty, patience and a sense of humour.', 'I enjoy hosting friends and trying new recipes.', 'Serving others is what keeps me grounded.'];
const BIO_CLOSERS = ['Looking for a partner to build a kind, faithful home with.', 'Hoping to meet someone sincere who puts deen first.', 'Seeking a spouse who is ready for marriage and family.', 'Family introduction welcome once we both feel comfortable.'];

/** Small seeded generator (mulberry32), so a person never changes between runs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stableId(kind: string, index: number): string {
  const h = createHash('sha256').update(`loadtest-seed:${kind}:${index}`).digest('hex');
  // Version 4 layout, because downstream code only needs a valid UUID.
  const variant = '89ab'[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// 555-0100 to 555-0199 is reserved for fiction in every US area code.
const AREA_CODES = Array.from({ length: 789 }, (_, i) => 201 + i).filter((a) => a % 100 !== 11);

export function seedPerson(index: number) {
  const next = rng(index + 1);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];

  const gender = index % 2 === 0 ? ('MALE' as const) : ('FEMALE' as const);
  const [city, state] = pick(PLACES);
  const age = 21 + Math.floor(next() * 25);
  const birthDate = new Date(Date.UTC(new Date().getUTCFullYear() - age - 1, Math.floor(next() * 12), 1 + Math.floor(next() * 28)));

  const roll = next();
  const maritalStatus = roll < 0.7 ? ('NEVER_MARRIED' as const) : roll < 0.92 ? ('DIVORCED' as const) : ('WIDOWED' as const);
  const hasChildren = maritalStatus !== 'NEVER_MARRIED' && next() < 0.5;
  const childrenCount = hasChildren ? 1 + Math.floor(next() * 4) : null;

  const area = AREA_CODES[Math.floor(index / 100) % AREA_CODES.length];
  const number = String(index % 100).padStart(2, '0');

  return {
    id: stableId('user', index),
    profileId: stableId('profile', index),
    publicId: createHash('sha256').update(`loadtest-seed:public:${index}`).digest('base64url').slice(0, 12),
    email: `lt-seed-${String(index).padStart(5, '0')}${EMAIL_DOMAIN}`,
    phone: `+1${area}55501${number}`,
    gender,
    firstName: pick(gender === 'MALE' ? MALE_NAMES : FEMALE_NAMES),
    lastName: pick(LAST_NAMES),
    dob: birthDate.toISOString().slice(0, 10),
    ethnicity: pick(ETHNICITIES),
    city,
    state,
    bio: `${pick(BIO_OPENERS)} ${pick(BIO_MIDDLES)} ${pick(BIO_CLOSERS)}`,
    tier: pick(['FREE', 'FREE', 'FREE', 'SILVER', 'GOLD'] as const),
    biodata: {
      hideLocation: false,
      legalStatus: pick(['Citizen', 'Permanent Resident']),
      education: pick(EDUCATION),
      profession: pick(PROFESSIONS),
      relocate: pick(['Yes', 'No', 'Open']),
      religiousPractice: pick(PRACTICE),
      prayerFrequency: pick(PRAYER),
      dietaryPreference: pick(['Zabiha', 'Halal']),
      partnerPreferences: 'Kind, family-oriented and serious about marriage.',
    },
    maritalStatus,
    hasChildren,
    childrenCount,
    openToDivorced: next() < 0.5,
    openToWidowed: next() < 0.45,
    openToChildren: next() < 0.35,
  };
}

/** Derived from the secret: indexes are public, the session token must not be. */
export function sessionToken(index: number, secret: string): string {
  return createHmac('sha256', secret).update(`loadtest-seed:session:${index}`).digest('base64url');
}

/** The cookie value better-auth sets, as BetterAuthGuard verifies it. */
export function sessionCookie(token: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

/** Same iv:tag:cipher format as EncryptionService. */
export function encrypt(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${body.toString('base64')}`;
}
