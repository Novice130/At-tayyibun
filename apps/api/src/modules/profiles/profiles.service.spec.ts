import { BadRequestException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { DrizzleService } from '../../db/drizzle.service';
import { EncryptionService } from '../../services/encryption.service';
import { AvatarService } from '../../services/avatar.service';
import { Gender } from '../../common/types/role';
import { chain, createDbMock } from '../../test/drizzle-mock';

const USER_ID = 'user-uuid';

/** A birthday exactly `years` ago, offset by `days` (negative = younger). */
function birthday(years: number, days = 0): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + days);
  return d;
}

describe('ProfilesService', () => {
  let db: ReturnType<typeof createDbMock>;
  let service: ProfilesService;

  beforeEach(() => {
    db = createDbMock();
    service = new ProfilesService(
      { db } as unknown as DrizzleService,
      {
        encrypt: (v: string) => `enc:${v}`,
        decrypt: (v: string) => v.replace(/^enc:/, ''),
        decryptJson: (v: string) => JSON.parse(v.replace(/^enc:/, '')),
      } as unknown as EncryptionService,
      { getAvatarUrl: () => 'https://api.dicebear.com/x.svg' } as unknown as AvatarService,
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('updateMyProfile age gate', () => {
    // App Store 1.1.4 / 2.3.x: matrimony is 18+, and the server must enforce it
    // independently of the client's capped date picker.
    it('rejects a date of birth under 18', async () => {
      db.select.mockReturnValueOnce(chain([{ userId: USER_ID }]));
      await expect(
        service.updateMyProfile(USER_ID, { dob: birthday(17) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('rejects someone one day short of their 18th birthday', async () => {
      db.select.mockReturnValueOnce(chain([{ userId: USER_ID }]));
      await expect(
        service.updateMyProfile(USER_ID, { dob: birthday(18, 1) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts someone who turned 18 today', async () => {
      db.select.mockReturnValueOnce(chain([{ userId: USER_ID }]));
      jest.spyOn(service, 'getMyProfile').mockResolvedValue({ ok: true } as any);
      await expect(service.updateMyProfile(USER_ID, { dob: birthday(18) })).resolves.toEqual({ ok: true });
    });

    it('leaves an update without a dob alone', async () => {
      db.select.mockReturnValueOnce(chain([{ userId: USER_ID }]));
      jest.spyOn(service, 'getMyProfile').mockResolvedValue({ ok: true } as any);
      await expect(
        service.updateMyProfile(USER_ID, { firstName: 'Aisha', gender: Gender.FEMALE }),
      ).resolves.toEqual({ ok: true });
    });
  });

  describe('updateMyProfile field clearing', () => {
    it('clears a field set to an empty string rather than treating it as a no-op', async () => {
      db.select.mockReturnValueOnce(chain([{ userId: USER_ID }]));
      jest.spyOn(service, 'getMyProfile').mockResolvedValue({ ok: true } as any);
      const set = jest.fn((_v: any) => chain([]));
      db.update.mockReturnValueOnce({ set } as any);

      await service.updateMyProfile(USER_ID, { city: '' });

      // A truthiness guard would have dropped this key entirely.
      expect(set.mock.calls[0][0]).toHaveProperty('city', null);
    });
  });

  describe('browseProfiles', () => {
    it('returns filtered and mapped profile summaries', async () => {
      const mockProfile = {
        id: 'prof-1',
        userId: 'user-1',
        firstName: 'Fatima',
        dob: '1998-05-15',
        gender: Gender.FEMALE,
        ethnicity: 'Arab',
        city: 'Chicago',
        state: 'IL',
        publicFields: { bio: 'A bio' },
        profileComplete: true,
      };
      const mockUser = {
        publicId: 'usr_pub_1',
        image: 'https://attayyibun.com/avatars/female/female-1.jpg',
        rankBoost: 0,
        membershipTier: 'FREE',
        createdAt: '2026-01-01',
      };

      // 1. Viewer gender lookup (MALE -> sees FEMALE)
      db.select.mockReturnValueOnce(chain([{ gender: Gender.MALE }]));
      // 2. Browse query rows
      db.select.mockReturnValueOnce(chain([{ profile: mockProfile, user: mockUser }]));
      // 3. Count query
      db.select.mockReturnValueOnce(chain([{ value: 1 }]));

      const result = await service.browseProfiles(
        {
          gender: Gender.FEMALE,
          ethnicity: 'Arab',
          minAge: 20,
          maxAge: 35,
          sortBy: 'age',
          order: 'asc',
        },
        'viewer-uuid',
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].firstName).toBe('Fatima');
      expect(result.data[0].ethnicity).toBe('Arab');
      expect(result.data[0].age).toBeGreaterThan(0);
      expect(result.meta.total).toBe(1);
    });

    it('works safely without a viewerId and defaults gender', async () => {
      db.select
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ value: 0 }]));

      const result = await service.browseProfiles({
        gender: Gender.MALE,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getProfileByPublicId', () => {
    const baseProfile = {
      id: 'prof-1',
      userId: 'target-uuid',
      firstName: 'Fatima',
      dob: '1998-05-15',
      gender: Gender.FEMALE,
      ethnicity: 'Arab',
      city: 'Chicago',
      state: 'IL',
      bioEnc: 'enc:A bio',
      biodataJsonEnc: 'enc:{}',
      publicFields: { bio: 'A bio' },
      profileComplete: true,
    };
    const baseUser = {
      id: 'target-uuid',
      publicId: 'usr_pub_1',
      image: 'https://attayyibun.com/avatars/female/female-1.jpg',
      membershipTier: 'FREE',
      profiles: baseProfile,
    };

    it('exposes the whitelisted biodata but never guardian details or nikahIntent', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        ...baseUser,
        profiles: {
          ...baseProfile,
          biodataJsonEnc:
            'enc:' +
            JSON.stringify({
              education: "Master's",
              profession: 'Doctor',
              partnerPreferences: 'Kind and family-oriented',
              dealBreakers: 'Smoker',
              guardianName: 'Uncle Bob',
              guardianPhone: '+15551234567',
              guardianEmail: 'guardian@example.com',
              nikahIntent: true,
            }),
        },
      });

      const result: any = await service.getProfileByPublicId('usr_pub_1', true);

      expect(result.biodata).toEqual({
        education: "Master's",
        profession: 'Doctor',
        partnerPreferences: 'Kind and family-oriented',
        dealBreakers: 'Smoker',
      });
      expect(result.biodata).not.toHaveProperty('guardianName');
      expect(result.biodata).not.toHaveProperty('guardianPhone');
      expect(result.biodata).not.toHaveProperty('guardianEmail');
      expect(result.biodata).not.toHaveProperty('nikahIntent');
    });

    it('always shows city and state even when hideLocation is set', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        ...baseUser,
        profiles: { ...baseProfile, publicFields: { bio: 'A bio', hideLocation: true } },
      });

      const result: any = await service.getProfileByPublicId('usr_pub_1', true);

      expect(result.city).toBe('Chicago');
      expect(result.state).toBe('IL');
    });

    it('hides the first name when hideName is set', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        ...baseUser,
        profiles: { ...baseProfile, publicFields: { bio: 'A bio', hideName: true } },
      });

      const result: any = await service.getProfileByPublicId('usr_pub_1', true);

      expect(result.firstName).toBeNull();
    });

    it('omits biodata for unauthenticated viewers', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({ ...baseUser });

      const result: any = await service.getProfileByPublicId('usr_pub_1', false);

      expect(result.isFullView).toBe(false);
      expect(result.biodata).toBeUndefined();
    });
  });
});
