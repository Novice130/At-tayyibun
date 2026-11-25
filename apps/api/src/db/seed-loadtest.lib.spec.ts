import { createHmac } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from '../modules/profiles/dto';
import { hasCompleteProfile, MARITAL_STATUSES } from '../modules/profiles/marital-match';
import {
  assertSeedTarget,
  encrypt,
  MAX_REAL_USERS,
  refuseIfRealData,
  seedCounts,
  seedPerson,
  sessionCookie,
  sessionToken,
} from './seed-loadtest.lib';

describe('assertSeedTarget', () => {
  const good = { DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/lt', SEED_ALLOWED_HOST: '127.0.0.1' };

  it('accepts an exact host match', () => {
    expect(assertSeedTarget(good)).toBe(good.DATABASE_URL);
  });

  it.each([
    ['no DATABASE_URL', { DATABASE_URL: undefined }],
    ['no SEED_ALLOWED_HOST', { SEED_ALLOWED_HOST: undefined }],
    ['empty SEED_ALLOWED_HOST', { SEED_ALLOWED_HOST: '' }],
    ['different host', { SEED_ALLOWED_HOST: 'localhost' }],
    ['suffix of the real host', { DATABASE_URL: 'postgres://u:p@db.127.0.0.1.evil.example/lt' }],
    ['host only in the query string', { DATABASE_URL: 'postgres://u:p@prod.example/lt?host=127.0.0.1' }],
    ['host only in the password', { DATABASE_URL: 'postgres://u:127.0.0.1@prod.example/lt' }],
    ['unparseable URL', { DATABASE_URL: 'not a url' }],
    ['wildcard', { SEED_ALLOWED_HOST: '*' }],
  ])('refuses: %s', (_label, override) => {
    expect(() => assertSeedTarget({ ...good, ...override })).toThrow(/seed refused/);
  });

  it.each([
    ['WEB_URL', 'https://attayyibun.com'],
    ['BETTER_AUTH_URL', 'https://www.attayyibun.com'],
  ])('refuses when %s says production', (name, value) => {
    expect(() => assertSeedTarget({ ...good, [name]: value })).toThrow(/seed refused/);
  });

  it('never echoes the connection string in its message', () => {
    expect(() => assertSeedTarget({ ...good, SEED_ALLOWED_HOST: 'other' })).toThrow(
      expect.not.objectContaining({ message: expect.stringContaining('u:p@') }),
    );
  });
});

describe('refuseIfRealData', () => {
  it('passes at the limit and refuses above it', () => {
    expect(() => refuseIfRealData(MAX_REAL_USERS)).not.toThrow();
    expect(() => refuseIfRealData(MAX_REAL_USERS + 1)).toThrow(/seed refused/);
  });
});

describe('seedCounts', () => {
  it('defaults to 5000 profiles and 250 accounts', () => {
    expect(seedCounts({})).toEqual({ profiles: 5000, accounts: 250 });
  });

  it('accepts the top of the range', () => {
    expect(seedCounts({ SEED_PROFILES: '10000', SEED_ACCOUNTS: '500' })).toEqual({ profiles: 10000, accounts: 500 });
  });

  it.each([
    ['too few profiles', { SEED_PROFILES: '4999' }],
    ['too many profiles', { SEED_PROFILES: '10001' }],
    ['too few accounts', { SEED_ACCOUNTS: '249' }],
    ['not a number', { SEED_PROFILES: 'lots' }],
  ])('refuses: %s', (_label, env) => {
    expect(() => seedCounts(env)).toThrow(/seed refused/);
  });
});

describe('seedPerson', () => {
  const people = Array.from({ length: 2000 }, (_, i) => seedPerson(i));

  it('is deterministic, which is what makes re-runs idempotent', () => {
    expect(seedPerson(123)).toEqual(seedPerson(123));
  });

  it('uses only .invalid emails, in the domain the Locust pool accepts', () => {
    expect(people.every((p) => p.email.endsWith('@loadtest.invalid'))).toBe(true);
  });

  it.each(['id', 'profileId', 'publicId', 'email', 'phone'] as const)('%s is unique', (key) => {
    expect(new Set(people.map((p) => p[key])).size).toBe(people.length);
  });

  it('uses only numbers reserved for fiction', () => {
    expect(people.every((p) => /^\+1[2-9]\d{2}55501\d{2}$/.test(p.phone))).toBe(true);
  });

  it('keeps ids valid UUIDs and publicId within the column', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(people.every((p) => uuid.test(p.id) && uuid.test(p.profileId))).toBe(true);
    expect(people.every((p) => p.publicId.length === 12)).toBe(true);
  });

  it('balances genders and covers every marital status', () => {
    expect(people.filter((p) => p.gender === 'MALE').length).toBe(1000);
    for (const status of MARITAL_STATUSES) {
      expect(people.some((p) => p.maritalStatus === status)).toBe(true);
    }
  });

  it('passes the completeness gate', () => {
    expect(people.every((p) => hasCompleteProfile({ ...p, profileComplete: true }))).toBe(true);
  });

  it('never gives a never-married person children, and counts match', () => {
    for (const p of people) {
      if (p.maritalStatus === 'NEVER_MARRIED') expect(p.hasChildren).toBe(false);
      expect(p.childrenCount === null).toBe(!p.hasChildren);
    }
  });

  it('every person is adult and fits the API validation', async () => {
    const year = new Date().getFullYear();
    for (const p of people.slice(0, 100)) {
      expect(year - Number(p.dob.slice(0, 4))).toBeGreaterThanOrEqual(21);
      const dto = plainToInstance(UpdateProfileDto, {
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob,
        gender: p.gender,
        ethnicity: p.ethnicity,
        city: p.city,
        state: p.state,
        bio: p.bio,
        biodata: p.biodata,
        maritalStatus: p.maritalStatus,
        hasChildren: p.hasChildren,
        childrenCount: p.childrenCount,
        openToDivorced: p.openToDivorced,
        openToWidowed: p.openToWidowed,
        openToChildren: p.openToChildren,
      });
      expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    }
  });
});

describe('session cookie', () => {
  const secret = 's'.repeat(32);

  it('derives the token from the secret, so the public repo does not reveal it', () => {
    expect(sessionToken(5, secret)).toBe(sessionToken(5, secret));
    expect(sessionToken(5, secret)).not.toBe(sessionToken(5, 't'.repeat(32)));
    expect(sessionToken(5, secret)).not.toBe(sessionToken(6, secret));
  });

  it('signs the way BetterAuthGuard verifies', () => {
    const token = sessionToken(1, secret);
    const [rawToken, signature] = decodeURIComponent(sessionCookie(token, secret)).split('.');
    expect(rawToken).toBe(token);
    expect(signature).toBe(createHmac('sha256', secret).update(token).digest('base64'));
  });
});

describe('encrypt', () => {
  it('produces the iv:tag:cipher format EncryptionService reads', () => {
    expect(encrypt('hello', 'ab'.repeat(32)).split(':')).toHaveLength(3);
  });
});
