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
      { encrypt: (v: string) => `enc:${v}`, decrypt: (v: string) => v.replace(/^enc:/, '') } as unknown as EncryptionService,
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
});
