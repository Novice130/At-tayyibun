import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { DrizzleService } from '../../db/drizzle.service';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { EncryptionService } from '../../services/encryption.service';
import { chain, createDbMock } from '../../test/drizzle-mock';

const REQUESTER_ID = 'requester-uuid';
const TARGET_ID = 'target-uuid';

function profile(over: Record<string, unknown> = {}) {
  return {
    firstName: 'A',
    ethnicity: 'Arab',
    city: 'Chicago',
    state: 'IL',
    profileComplete: true,
    maritalStatus: 'NEVER_MARRIED',
    hasChildren: false,
    childrenCount: null,
    openToDivorced: false,
    openToWidowed: false,
    openToChildren: false,
    ...over,
  };
}

describe('RequestsService', () => {
  let db: ReturnType<typeof createDbMock>;
  let service: RequestsService;
  let audit: { log: jest.Mock; logInfoRequest: jest.Mock };
  let email: { sendContactRequestEmail: jest.Mock };

  beforeEach(() => {
    db = createDbMock();
    audit = { log: jest.fn(async () => undefined), logInfoRequest: jest.fn(async () => undefined) };
    email = { sendContactRequestEmail: jest.fn(async () => undefined) };
    service = new RequestsService(
      { db } as unknown as DrizzleService,
      audit as unknown as AuditService,
      email as unknown as EmailService,
      {} as unknown as EncryptionService,
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('createRequest', () => {
    /**
     * findFirst #1 -> requester, #2 -> target. select #1 is the block check,
     * #2 the existing pending request lookup.
     */
    function arrange(requesterProfile: unknown, targetProfile: unknown, blocked = false) {
      db.query.users.findFirst
        .mockResolvedValueOnce({ id: REQUESTER_ID, publicId: 'usr_pub_r', email: 'r@example.com', profiles: [requesterProfile] })
        .mockResolvedValueOnce({ id: TARGET_ID, publicId: 'usr_pub_t', email: 't@example.com', profiles: [targetProfile] });
      db.select
        .mockReturnValueOnce(chain(blocked ? [{ id: 'block-1' }] : []))
        .mockReturnValueOnce(chain([]));
      db.insert.mockReturnValueOnce(chain([{ id: 'req-1' }]));
    }

    it('creates a request between a complete, mutually matching pair', async () => {
      arrange(profile(), profile());
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).resolves.toEqual({ id: 'req-1' });
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects a requester whose profile is not complete', async () => {
      arrange(profile({ profileComplete: false }), profile());
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Please complete your profile before sending a request.');
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('rejects a complete requester with no marital status (completed by an older image)', async () => {
      arrange(profile({ maritalStatus: null }), profile());
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Please complete your profile before sending a request.');
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('rejects a complete requester with hasChildren unanswered', async () => {
      arrange(profile({ hasChildren: null }), profile());
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('gives an incomplete requester the 400 even when blocked (no block oracle)', async () => {
      arrange(profile({ profileComplete: false }), profile(), true);
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Please complete your profile before sending a request.');
      expect(db.select).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('gives an incomplete requester the 400 before looking up the target at all', async () => {
      db.query.users.findFirst.mockResolvedValueOnce({
        id: REQUESTER_ID,
        publicId: 'usr_pub_r',
        profiles: [profile({ profileComplete: false })],
      });
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_missing').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Please complete your profile before sending a request.');
      expect(db.query.users.findFirst).toHaveBeenCalledTimes(1);
    });

    it('gives an incomplete requester the 400 even when the target ruled them out', async () => {
      arrange(profile({ maritalStatus: null }), profile({ hasChildren: true }));
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Please complete your profile before sending a request.');
    });

    it('404s with the block message when the target ruled the requester out', async () => {
      // Target is never married and open to nobody else; requester is divorced.
      arrange(profile({ maritalStatus: 'DIVORCED', openToDivorced: true }), profile());
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('User not found');
      expect(db.insert).not.toHaveBeenCalled();
      expect(email.sendContactRequestEmail).not.toHaveBeenCalled();
    });

    it('404s when the requester ruled the target out', async () => {
      // Target has children and is open to everything; requester is not open to children.
      arrange(profile(), profile({ hasChildren: true, openToDivorced: true, openToWidowed: true, openToChildren: true }));
      const err = await service.createRequest(REQUESTER_ID, 'usr_pub_t').catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('User not found');
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('treats a target with unanswered status as never married, no children', async () => {
      arrange(profile(), profile({ maritalStatus: null, hasChildren: null }));
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).resolves.toEqual({ id: 'req-1' });
    });

    it('still 404s on a block', async () => {
      arrange(profile(), profile(), true);
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).rejects.toThrow('User not found');
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
