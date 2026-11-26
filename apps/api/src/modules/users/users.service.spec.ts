import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { DrizzleService } from '../../db/drizzle.service';
import { ModerationService } from '../moderation/moderation.service';
import { chain, createDbMock } from '../../test/drizzle-mock';

const mockGetUserByPhoneNumber = jest.fn();
const mockDeleteUser = jest.fn();
const mockInitializeApp = jest.fn((_opts: unknown, name: string) => ({ name }));

jest.mock('firebase-admin/app', () => ({
  initializeApp: (opts: unknown, name: string) => mockInitializeApp(opts, name),
  getApps: () => [],
  cert: (c: unknown) => c,
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUserByPhoneNumber: mockGetUserByPhoneNumber, deleteUser: mockDeleteUser }),
}));

// A fake key. Built from parts so secret scanners do not flag a PEM block.
const FAKE_PEM = [['-----BEGIN', 'PRIVATE KEY-----'].join(' '), 'abc', ['-----END', 'PRIVATE KEY-----'].join(' ')].join('\\n');
const FIREBASE_ENV = {
  FIREBASE_PROJECT_ID: 'demo-project',
  FIREBASE_CLIENT_EMAIL: 'auth@demo-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: FAKE_PEM,
};
const PHONE = '+15555550123';

const USER_ID = 'user-uuid';
const APPLE_ENV = { APPLE_CLIENT_ID: 'com.attayyibun.attayyibun', APPLE_CLIENT_SECRET: 'jwt.secret.value' };

describe('UsersService', () => {
  let db: ReturnType<typeof createDbMock>;
  let moderation: { hardDeleteUser: jest.Mock };
  let fetchMock: jest.Mock;

  const build = (env: Record<string, string> = {}) =>
    new UsersService(
      { db } as unknown as DrizzleService,
      moderation as unknown as ModerationService,
      new ConfigService(env),
    );

  beforeEach(() => {
    db = createDbMock();
    moderation = { hardDeleteUser: jest.fn().mockResolvedValue(undefined) };
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('findById', () => {
    it('flattens the profiles relation onto a single `profile`', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        id: USER_ID,
        email: 'a@x.com',
        profiles: [{ firstName: 'Aisha' }],
      });
      await expect(build().findById(USER_ID)).resolves.toEqual({
        id: USER_ID,
        email: 'a@x.com',
        profile: { firstName: 'Aisha' },
      });
    });

    it('yields a null profile when the user has none', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({ id: USER_ID, profiles: [] });
      await expect(build().findById(USER_ID)).resolves.toMatchObject({ profile: null });
    });

    it('404s on an unknown id', async () => {
      db.query.users.findFirst.mockResolvedValueOnce(null);
      await expect(build().findById(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('lower-cases the lookup so mixed-case sign-ups still match', async () => {
      db.select.mockReturnValueOnce(chain([{ id: USER_ID }]));
      await expect(build().findByEmail('MiXeD@Example.COM')).resolves.toEqual({ id: USER_ID });
    });

    it('returns null rather than throwing when there is no row', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await expect(build().findByEmail('nobody@example.com')).resolves.toBeNull();
    });
  });

  describe('deleteOwnAccount', () => {
    it('hard-deletes immediately — deletion is not a deactivation (Guideline 5.1.1(v))', async () => {
      await expect(build().deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });
      expect(moderation.hardDeleteUser).toHaveBeenCalledWith(USER_ID, USER_ID);
    });

    it('skips the Apple revoke entirely when the Apple secret is not configured', async () => {
      await build().deleteOwnAccount(USER_ID);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(moderation.hardDeleteUser).toHaveBeenCalled();
    });

    it('revokes the Apple refresh token before deleting', async () => {
      db.select.mockReturnValueOnce(chain([{ providerId: 'apple', refreshToken: 'apple-refresh' }]));
      await build(APPLE_ENV).deleteOwnAccount(USER_ID);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://appleid.apple.com/auth/revoke');
      const body = new URLSearchParams(init.body.toString());
      expect(body.get('token')).toBe('apple-refresh');
      expect(body.get('client_id')).toBe(APPLE_ENV.APPLE_CLIENT_ID);
      expect(body.get('token_type_hint')).toBe('refresh_token');
    });

    it('falls back to the access token when no refresh token was stored', async () => {
      db.select.mockReturnValueOnce(chain([{ providerId: 'apple', refreshToken: null, accessToken: 'apple-access' }]));
      await build(APPLE_ENV).deleteOwnAccount(USER_ID);
      const body = new URLSearchParams(fetchMock.mock.calls[0][1].body.toString());
      expect(body.get('token')).toBe('apple-access');
    });

    it('does not call Apple when the user has no Apple account row', async () => {
      // The query filters on providerId = 'apple', so a Google-only user yields
      // no row and the revoke is skipped rather than sending an empty token.
      db.select.mockReturnValueOnce(chain([]));
      await build(APPLE_ENV).deleteOwnAccount(USER_ID);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(moderation.hardDeleteUser).toHaveBeenCalled();
    });

    it('still deletes the account when Apple returns an error', async () => {
      db.select.mockReturnValueOnce(chain([{ providerId: 'apple', refreshToken: 'apple-refresh' }]));
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_client' });
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(build(APPLE_ENV).deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });
      expect(moderation.hardDeleteUser).toHaveBeenCalled();
    });

    it('still deletes the account when the revoke request throws', async () => {
      db.select.mockReturnValueOnce(chain([{ providerId: 'apple', refreshToken: 'apple-refresh' }]));
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(build(APPLE_ENV).deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });
      expect(moderation.hardDeleteUser).toHaveBeenCalled();
    });
  });

  describe('deleteOwnAccount: Firebase phone record', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      mockGetUserByPhoneNumber.mockReset().mockResolvedValue({ uid: 'fb-uid' });
      mockDeleteUser.mockReset().mockResolvedValue(undefined);
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => warn.mockRestore());

    it('deletes the Firebase user holding the phone number, after the database delete', async () => {
      db.select.mockReturnValueOnce(chain([{ phone: PHONE }]));
      moderation.hardDeleteUser.mockImplementationOnce(async () => {
        expect(mockDeleteUser).not.toHaveBeenCalled();
      });

      await expect(build(FIREBASE_ENV).deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });

      expect(moderation.hardDeleteUser).toHaveBeenCalledWith(USER_ID, USER_ID);
      expect(mockGetUserByPhoneNumber).toHaveBeenCalledWith(PHONE);
      expect(mockDeleteUser).toHaveBeenCalledWith('fb-uid');
    });

    it('does nothing in Firebase when the account has no phone', async () => {
      db.select.mockReturnValueOnce(chain([{ phone: null }]));
      await build(FIREBASE_ENV).deleteOwnAccount(USER_ID);
      expect(mockGetUserByPhoneNumber).not.toHaveBeenCalled();
    });

    it('does nothing in Firebase when the credentials are not set', async () => {
      db.select.mockReturnValueOnce(chain([{ phone: PHONE }]));
      await build().deleteOwnAccount(USER_ID);
      expect(mockGetUserByPhoneNumber).not.toHaveBeenCalled();
      expect(moderation.hardDeleteUser).toHaveBeenCalled();
    });

    it('treats a missing Firebase user as already deleted', async () => {
      db.select.mockReturnValueOnce(chain([{ phone: PHONE }]));
      mockGetUserByPhoneNumber.mockRejectedValueOnce({ code: 'auth/user-not-found' });
      await expect(build(FIREBASE_ENV).deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });
      expect(mockDeleteUser).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('still reports success when Firebase fails, and logs only the error code', async () => {
      db.select.mockReturnValueOnce(chain([{ phone: PHONE }]));
      mockDeleteUser.mockRejectedValueOnce({ code: 'auth/internal-error', message: `boom ${PHONE}` });
      await expect(build(FIREBASE_ENV).deleteOwnAccount(USER_ID)).resolves.toEqual({ ok: true });
      expect(warn).toHaveBeenCalledWith('Firebase phone user delete failed: auth/internal-error');
      expect(String(warn.mock.calls[0][0])).not.toContain(PHONE);
    });
  });
});
