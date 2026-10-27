import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { SQL } from 'drizzle-orm';
import { ProfilesService } from './profiles.service';
import { DrizzleService } from '../../db/drizzle.service';
import { EncryptionService } from '../../services/encryption.service';
import { AvatarService } from '../../services/avatar.service';
import { AuditService } from '../../services/audit.service';
import { Gender } from '../../common/types/role';
import { chain, createDbMock } from '../../test/drizzle-mock';
import { DEFAULT_SIDE, MatchSide, mutualMatchSql } from './marital-match';

const USER_ID = 'user-uuid';

/** The private keys that must never reach another member. */
const MARITAL_KEYS = ['maritalStatus', 'hasChildren', 'childrenCount', 'openToDivorced', 'openToWidowed', 'openToChildren'];

const dialect = new PgDialect();

/** Renders a SQL condition with placeholders numbered out, so fragments compare by shape. */
function render(cond: SQL): { text: string; params: unknown[] } {
  const { sql: text, params } = dialect.sqlToQuery(cond);
  return { text: text.replace(/\$\d+/g, '$?'), params };
}

/**
 * Like `chain`, but records the argument of every `.where(...)` call so a spec
 * can inspect the condition the service built.
 */
function recordingChain<T>(result: T, wheres: SQL[]): any {
  const promise = Promise.resolve(result);
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return (promise as any)[prop].bind(promise);
        }
        if (prop === 'where') {
          return (cond: SQL) => {
            wheres.push(cond);
            return proxy;
          };
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

/** A complete viewer row as browse's viewer lookup selects it. */
function viewerRow(over: Partial<MatchSide & { gender: string; profileComplete: boolean }> = {}) {
  return {
    gender: Gender.MALE,
    profileComplete: true,
    maritalStatus: 'NEVER_MARRIED',
    hasChildren: false,
    openToDivorced: false,
    openToWidowed: false,
    openToChildren: false,
    ...over,
  };
}

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

    it('is never complete when null status is sent over a stored answer', async () => {
      const set = arrange({ ...COMPLETE_ROW, maritalStatus: 'DIVORCED', hasChildren: false });
      await service.updateMyProfile(USER_ID, { maritalStatus: null as any });
      expect(set.mock.calls[0][0]).toMatchObject({ maritalStatus: null, profileComplete: false });
    });

    it('is never complete when null hasChildren is sent over a stored answer', async () => {
      const set = arrange({ ...COMPLETE_ROW, maritalStatus: 'DIVORCED', hasChildren: false });
      await service.updateMyProfile(USER_ID, { hasChildren: null as any });
      expect(set.mock.calls[0][0]).toMatchObject({ hasChildren: null, profileComplete: false });
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

    it('still returns the saved profile when the audit write fails, with a warning that has no values', async () => {
      arrange({ userId: USER_ID });
      audit.log.mockRejectedValueOnce(new Error('insert into audit_logs failed: DIVORCED'));
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(
        service.updateMyProfile(USER_ID, { maritalStatus: 'DIVORCED', hasChildren: true }),
      ).resolves.toEqual({ ok: true });

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(warn.mock.calls[0]);
      expect(logged).not.toContain('DIVORCED');
      expect(logged).not.toContain('hasChildren');
      warn.mockRestore();
    });

    it('does not audit a resend of unchanged answers', async () => {
      arrange({
        ...COMPLETE_ROW,
        maritalStatus: 'DIVORCED',
        hasChildren: true,
        childrenCount: 2,
        openToDivorced: true,
        openToWidowed: false,
        openToChildren: false,
      });
      await service.updateMyProfile(USER_ID, {
        maritalStatus: 'DIVORCED',
        hasChildren: true,
        childrenCount: 2,
        openToDivorced: true,
        openToWidowed: false,
        openToChildren: false,
      });
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('audits only the key that changed when everything is resent', async () => {
      arrange({
        ...COMPLETE_ROW,
        maritalStatus: 'DIVORCED',
        hasChildren: false,
        childrenCount: null,
        openToDivorced: false,
        openToWidowed: false,
        openToChildren: false,
      });
      await service.updateMyProfile(USER_ID, {
        maritalStatus: 'DIVORCED',
        hasChildren: false,
        childrenCount: null as any,
        openToDivorced: true,
        openToWidowed: false,
        openToChildren: false,
      });
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log.mock.calls[0][0].metadata).toEqual({ fields: ['openToDivorced'] });
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

      // 1. Viewer lookup (MALE -> sees FEMALE), complete profile
      db.select.mockReturnValueOnce(chain([viewerRow()]));
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

    describe('profile completeness gate', () => {
      async function expectIncomplete(rows: unknown[]) {
        db.select.mockReturnValueOnce(chain(rows));
        const err = await service.browseProfiles({}, 'viewer-uuid').catch((e) => e);
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toEqual({
          statusCode: 403,
          code: 'PROFILE_INCOMPLETE',
          message: 'Please complete your profile to browse.',
        });
        // Only the viewer lookup ran: no page or count query.
        expect(db.select).toHaveBeenCalledTimes(1);
      }

      it('rejects a viewer whose profile is not complete', async () => {
        await expectIncomplete([viewerRow({ profileComplete: false })]);
      });

      it('rejects a complete viewer with no marital status (completed by an older image)', async () => {
        await expectIncomplete([viewerRow({ maritalStatus: null })]);
      });

      it('rejects a complete viewer with hasChildren unanswered', async () => {
        await expectIncomplete([viewerRow({ hasChildren: null })]);
      });

      it('rejects a signed-in viewer with no profile row', async () => {
        await expectIncomplete([]);
      });
    });

    describe('two-way marital matching', () => {
      function arrangeBrowse(viewer: unknown[] | null, rows: unknown[] = [], total = 0) {
        const wheres = { page: [] as SQL[], count: [] as SQL[] };
        if (viewer) db.select.mockReturnValueOnce(chain(viewer));
        db.select.mockReturnValueOnce(recordingChain(rows, wheres.page));
        db.select.mockReturnValueOnce(recordingChain([{ value: total }], wheres.count));
        return wheres;
      }

      function expectContains(where: SQL[], fragment: SQL) {
        expect(where).toHaveLength(1);
        const whole = render(where[0]);
        const part = render(fragment);
        expect(whole.text).toContain(part.text);
      }

      it('filters page and count by mutualMatchSql of the signed-in viewer', async () => {
        const viewer = viewerRow({
          maritalStatus: 'DIVORCED',
          hasChildren: true,
          openToWidowed: true,
          openToChildren: true,
        });
        const wheres = arrangeBrowse([viewer]);

        await service.browseProfiles({}, 'viewer-uuid');

        const side: MatchSide = {
          maritalStatus: 'DIVORCED',
          hasChildren: true,
          openToDivorced: false,
          openToWidowed: true,
          openToChildren: true,
        };
        const fragment = mutualMatchSql(side);
        // The viewer's answers shape the condition: divorced + children means
        // the candidate must be open to both.
        expect(render(fragment).text).toContain('"profiles"."open_to_divorced"');
        expect(render(fragment).text).toContain('"profiles"."open_to_children"');
        expectContains(wheres.page, fragment);
        expectContains(wheres.count, fragment);
      });

      it('uses DEFAULT_SIDE for an anonymous viewer, on page and count', async () => {
        const wheres = arrangeBrowse(null);

        await service.browseProfiles({});

        expect(db.select).toHaveBeenCalledTimes(2);
        expectContains(wheres.page, mutualMatchSql(DEFAULT_SIDE));
        expectContains(wheres.count, mutualMatchSql(DEFAULT_SIDE));
      });

      it('never returns the marital keys in browse items', async () => {
        const row = {
          profile: {
            userId: 'user-1',
            firstName: 'Fatima',
            dob: '1998-05-15',
            gender: Gender.FEMALE,
            ethnicity: 'Arab',
            city: 'Chicago',
            state: 'IL',
            publicFields: { bio: 'A bio' },
            profileComplete: true,
            maritalStatus: 'WIDOWED',
            hasChildren: true,
            childrenCount: 2,
            openToDivorced: true,
            openToWidowed: true,
            openToChildren: true,
          },
          user: { publicId: 'usr_pub_1', image: 'https://attayyibun.com/avatars/female/female-1.jpg', rankBoost: 0, membershipTier: 'FREE', createdAt: '2026-01-01' },
        };
        arrangeBrowse([viewerRow({ openToWidowed: true, openToChildren: true })], [row], 1);

        const result: any = await service.browseProfiles({}, 'viewer-uuid');

        expect(result.data).toHaveLength(1);
        for (const k of MARITAL_KEYS) expect(result.data[0]).not.toHaveProperty(k);
        expect(JSON.stringify(result)).not.toContain('WIDOWED');
      });
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

    describe('two-way marital matching', () => {
      const VIEWER_ID = 'viewer-uuid';
      const divorcedTarget = {
        ...baseUser,
        profiles: {
          ...baseProfile,
          maritalStatus: 'DIVORCED',
          hasChildren: true,
          childrenCount: 2,
          openToDivorced: false,
          openToWidowed: false,
          openToChildren: false,
        },
      };
      const neverMarriedViewer = {
        maritalStatus: 'NEVER_MARRIED',
        hasChildren: false,
        openToDivorced: false,
        openToWidowed: false,
        openToChildren: false,
      };

      /** findFirst -> target; select #1 block check; #2 viewer profile; #3 info request lookup. */
      function arrange(target: unknown, viewer: unknown[], requestRows: unknown[] = []) {
        const requestWheres: SQL[] = [];
        db.query.users.findFirst.mockResolvedValueOnce(target);
        db.select
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain(viewer))
          .mockReturnValueOnce(recordingChain(requestRows, requestWheres));
        return requestWheres;
      }

      it('404s a signed-in viewer who is not a mutual match and has no request with them', async () => {
        arrange(divorcedTarget, [neverMarriedViewer]);
        await expect(service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('uses the same 404 message as a block', async () => {
        arrange(divorcedTarget, [neverMarriedViewer]);
        await expect(service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID)).rejects.toThrow('Profile not found');
      });

      it('404s a signed-in viewer without a profile row (treated as the default side)', async () => {
        arrange(divorcedTarget, []);
        await expect(service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('404s a signed-in viewer who has not passed the phone gate too', async () => {
        arrange(divorcedTarget, [neverMarriedViewer]);
        await expect(service.getProfileByPublicId('usr_pub_1', false, VIEWER_ID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('shows the profile when an info request exists between them, checked in both directions', async () => {
        const wheres = arrange(divorcedTarget, [neverMarriedViewer], [{ id: 'req-1' }]);

        const result: any = await service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID);

        expect(result.publicId).toBe('usr_pub_1');
        expect(wheres).toHaveLength(1);
        const { text, params } = render(wheres[0]);
        expect(text).toContain('"info_requests"."requester_id"');
        expect(text).toContain('"info_requests"."target_id"');
        expect(text).not.toContain('"info_requests"."status"');
        expect(params.filter((p) => p === VIEWER_ID)).toHaveLength(2);
        expect(params.filter((p) => p === 'target-uuid')).toHaveLength(2);
      });

      it('does not apply the match rule to a same-gender view', async () => {
        db.query.users.findFirst.mockResolvedValueOnce(divorcedTarget);
        db.select
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain([{ ...neverMarriedViewer, gender: Gender.FEMALE }]));
        const result: any = await service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID);
        expect(result.publicId).toBe('usr_pub_1');
      });

      it('still applies the match rule across genders', async () => {
        arrange(divorcedTarget, [{ ...neverMarriedViewer, gender: Gender.MALE }]);
        await expect(service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('shows a mutual match without looking up requests', async () => {
        db.query.users.findFirst.mockResolvedValueOnce(divorcedTarget);
        db.select
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain([{ ...neverMarriedViewer, openToDivorced: true, openToChildren: true }]));

        const result: any = await service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID);

        expect(result.publicId).toBe('usr_pub_1');
        expect(db.select).toHaveBeenCalledTimes(2);
      });

      it('leaves anonymous visitors unchanged', async () => {
        db.query.users.findFirst.mockResolvedValueOnce(divorcedTarget);
        const result: any = await service.getProfileByPublicId('usr_pub_1', false);
        expect(result.isFullView).toBe(false);
        expect(db.select).not.toHaveBeenCalled();
      });

      it('lets the owner view their own profile', async () => {
        db.query.users.findFirst.mockResolvedValueOnce(divorcedTarget);
        const result: any = await service.getProfileByPublicId('usr_pub_1', true, 'target-uuid');
        expect(result.publicId).toBe('usr_pub_1');
      });

      it('never returns the marital keys, signed in or anonymous', async () => {
        arrange(divorcedTarget, [neverMarriedViewer], [{ id: 'req-1' }]);
        const full: any = await service.getProfileByPublicId('usr_pub_1', true, VIEWER_ID);
        db.query.users.findFirst.mockResolvedValueOnce(divorcedTarget);
        const anon: any = await service.getProfileByPublicId('usr_pub_1', false);

        for (const res of [full, anon]) {
          for (const k of MARITAL_KEYS) expect(res).not.toHaveProperty(k);
          for (const k of MARITAL_KEYS) expect(res.biodata ?? {}).not.toHaveProperty(k);
          expect(JSON.stringify(res)).not.toContain('DIVORCED');
        }
      });
    });
  });
});
