import { BadRequestException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { DrizzleService } from '../../db/drizzle.service';
import { EncryptionService } from '../../services/encryption.service';
import { AvatarService } from '../../services/avatar.service';
import { AuditService } from '../../services/audit.service';
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
  let audit: { log: jest.Mock };

  beforeEach(() => {
    db = createDbMock();
    audit = { log: jest.fn(async () => undefined) };
    service = new ProfilesService(
      { db } as unknown as DrizzleService,
      {
        encrypt: (v: string) => `enc:${v}`,
        decrypt: (v: string) => v.replace(/^enc:/, ''),
        decryptJson: (v: string) => JSON.parse(v.replace(/^enc:/, '')),
      } as unknown as EncryptionService,
      { getAvatarUrl: () => 'https://api.dicebear.com/x.svg' } as unknown as AvatarService,
      audit as unknown as AuditService,
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

  describe('updateMyProfile marital status', () => {
    const COMPLETE_ROW = {
      userId: USER_ID,
      firstName: 'Aisha',
      lastNameEnc: 'enc:Khan',
      dob: '1995-01-01',
      gender: 'FEMALE',
      ethnicity: 'Arab',
      bioEnc: 'enc:bio',
      maritalStatus: null,
      hasChildren: null,
    };

    function arrange(row: any) {
      db.select.mockReturnValueOnce(chain([row]));
      jest.spyOn(service, 'getMyProfile').mockResolvedValue({ ok: true } as any);
      const set = jest.fn((_v: any) => chain([]));
      db.update.mockReturnValueOnce({ set } as any);
      return set;
    }

    it('writes the status, children and open-to answers', async () => {
      const set = arrange({ userId: USER_ID });
      await service.updateMyProfile(USER_ID, {
        maritalStatus: 'DIVORCED',
        hasChildren: true,
        childrenCount: 2,
        openToChildren: true,
      });
      const payload = set.mock.calls[0][0];
      expect(payload).toMatchObject({
        maritalStatus: 'DIVORCED',
        hasChildren: true,
        childrenCount: 2,
        openToChildren: true,
      });
      expect(payload).not.toHaveProperty('openToDivorced');
      expect(payload).not.toHaveProperty('openToWidowed');
    });

    it('nulls childrenCount when hasChildren is false', async () => {
      const set = arrange({ userId: USER_ID });
      await service.updateMyProfile(USER_ID, { hasChildren: false, childrenCount: 3 });
      expect(set.mock.calls[0][0]).toMatchObject({ hasChildren: false, childrenCount: null });
    });

    it('nulls childrenCount when the stored hasChildren is false', async () => {
      const set = arrange({ userId: USER_ID, hasChildren: false });
      await service.updateMyProfile(USER_ID, { childrenCount: 3 });
      expect(set.mock.calls[0][0]).toMatchObject({ childrenCount: null });
    });

    it('leaves the six keys out of a partial update', async () => {
      const set = arrange({ userId: USER_ID });
      await service.updateMyProfile(USER_ID, { firstName: 'A', gender: Gender.FEMALE });
      const payload = set.mock.calls[0][0];
      for (const k of ['maritalStatus', 'hasChildren', 'childrenCount', 'openToDivorced', 'openToWidowed', 'openToChildren']) {
        expect(payload).not.toHaveProperty(k);
      }
    });

    it('is incomplete without a marital status', async () => {
      const set = arrange(COMPLETE_ROW);
      await service.updateMyProfile(USER_ID, { city: 'Chicago' });
      expect(set.mock.calls[0][0]).toMatchObject({ profileComplete: false });
    });

    it('is incomplete when hasChildren is still null', async () => {
      const set = arrange(COMPLETE_ROW);
      await service.updateMyProfile(USER_ID, { maritalStatus: 'WIDOWED' });
      expect(set.mock.calls[0][0]).toMatchObject({ profileComplete: false });
    });

    it('is complete once status and hasChildren are set, from this update', async () => {
      const set = arrange(COMPLETE_ROW);
      await service.updateMyProfile(USER_ID, { maritalStatus: 'NEVER_MARRIED', hasChildren: false });
      expect(set.mock.calls[0][0]).toMatchObject({ profileComplete: true });
    });

    it('uses stored status and hasChildren when not sent (hasChildren false counts)', async () => {
      const set = arrange({ ...COMPLETE_ROW, maritalStatus: 'DIVORCED', hasChildren: false });
      await service.updateMyProfile(USER_ID, { city: 'Chicago' });
      expect(set.mock.calls[0][0]).toMatchObject({ profileComplete: true });
    });

    it('audits which keys changed, never the values', async () => {
      arrange({ userId: USER_ID });
      await service.updateMyProfile(USER_ID, { maritalStatus: 'DIVORCED', hasChildren: true, childrenCount: 2 });
      expect(audit.log).toHaveBeenCalledTimes(1);
      const entry = audit.log.mock.calls[0][0];
      expect(entry).toMatchObject({ userId: USER_ID, action: 'profile.marital_prefs_updated' });
      expect(entry.metadata).toEqual({ fields: ['maritalStatus', 'hasChildren', 'childrenCount'] });
      expect(JSON.stringify(entry)).not.toContain('DIVORCED');
    });

    it('does not audit an update without the marital keys', async () => {
      arrange({ userId: USER_ID });
      await service.updateMyProfile(USER_ID, { city: 'Chicago' });
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('getMyProfile returns the six keys from the row', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        id: USER_ID,
        publicId: 'p',
        profiles: [
          {
            firstName: 'A', dob: '1995-01-01', gender: 'FEMALE', ethnicity: 'Arab',
            maritalStatus: 'WIDOWED', hasChildren: true, childrenCount: 2,
            openToDivorced: true, openToWidowed: false, openToChildren: true,
          },
        ],
      });
      const res = await service.getMyProfile(USER_ID);
      expect(res.profile).toMatchObject({
        maritalStatus: 'WIDOWED', hasChildren: true, childrenCount: 2,
        openToDivorced: true, openToWidowed: false, openToChildren: true,
      });
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

    it('gives unauthenticated viewers the truncated bio, not the decrypted one', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        ...baseUser,
        profiles: { ...baseProfile, bioEnc: 'enc:Full bio, call me on 555-0100', publicFields: { bio: 'Full bio' } },
      });

      const result: any = await service.getProfileByPublicId('usr_pub_1', false);

      expect(result.bio).toBe('Full bio');
    });

    it('gives authenticated viewers the full bio', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        ...baseUser,
        profiles: { ...baseProfile, bioEnc: 'enc:Full bio, call me on 555-0100', publicFields: { bio: 'Full bio' } },
      });

      const result: any = await service.getProfileByPublicId('usr_pub_1', true);

      expect(result.bio).toBe('Full bio, call me on 555-0100');
    });
  });
});
