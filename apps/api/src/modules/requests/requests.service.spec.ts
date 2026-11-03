import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { DrizzleService } from '../../db/drizzle.service';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { EncryptionService } from '../../services/encryption.service';
import { chain, createDbMock } from '../../test/drizzle-mock';

const REQUESTER_ID = 'requester-uuid';
const TARGET_ID = 'target-uuid';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();
const GUARDIAN = JSON.stringify({ guardianName: 'Sara', guardianPhone: '+1 312 555 0100', guardianEmail: 'sara@example.com' });

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
  let email: { sendContactRequestEmail: jest.Mock; sendContactLinkEmail: jest.Mock; sendRequestDeniedEmail: jest.Mock };

  beforeEach(() => {
    db = createDbMock();
    audit = { log: jest.fn(async () => undefined), logInfoRequest: jest.fn(async () => undefined) };
    email = {
      sendContactRequestEmail: jest.fn(async () => undefined),
      sendContactLinkEmail: jest.fn(async () => undefined),
      sendRequestDeniedEmail: jest.fn(async () => undefined),
    };
    service = new RequestsService(
      { db } as unknown as DrizzleService,
      audit as unknown as AuditService,
      email as unknown as EmailService,
      { decryptJson: (v: string) => JSON.parse(v) } as unknown as EncryptionService,
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

    it('closes a lapsed pending request first, so the sender can resend', async () => {
      arrange(profile(), profile());
      const set = jest.fn(() => chain([]));
      db.update.mockReturnValueOnce({ set });
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).resolves.toEqual({ id: 'req-1' });
      expect(set).toHaveBeenCalledWith({ status: 'EXPIRED' });
    });

    it('404s for a suspended target', async () => {
      db.query.users.findFirst
        .mockResolvedValueOnce({ id: REQUESTER_ID, publicId: 'usr_pub_r', profiles: [profile()] })
        .mockResolvedValueOnce({ id: TARGET_ID, suspendedAt: PAST, profiles: [profile()] });
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still 404s on a block', async () => {
      arrange(profile(), profile(), true);
      await expect(service.createRequest(REQUESTER_ID, 'usr_pub_t')).rejects.toThrow('User not found');
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('request lists', () => {
    const row = { id: 'req-1', requesterId: REQUESTER_ID, targetId: TARGET_ID, status: 'PENDING', expiresAt: FUTURE };
    const MARITAL_KEYS = ['maritalStatus', 'hasChildren', 'childrenCount', 'openToDivorced', 'openToWidowed', 'openToChildren'];

    it('incoming items carry the requester marital status and children', async () => {
      db.select.mockReturnValueOnce(chain([row]));
      db.query.users.findFirst.mockResolvedValueOnce({
        id: REQUESTER_ID,
        publicId: 'usr_pub_r',
        profiles: [profile({ maritalStatus: 'DIVORCED', hasChildren: true, childrenCount: 2 })],
      });
      const [item] = await service.getIncomingRequests(TARGET_ID);
      expect(item.requester?.profile).toMatchObject({ maritalStatus: 'DIVORCED', hasChildren: true, childrenCount: 2 });
      expect(item.requester?.profile).not.toHaveProperty('openToDivorced');
      expect(item.requester?.profile).not.toHaveProperty('openToWidowed');
      expect(item.requester?.profile).not.toHaveProperty('openToChildren');
    });

    it('incoming items return nulls for unanswered values', async () => {
      db.select.mockReturnValueOnce(chain([row]));
      db.query.users.findFirst.mockResolvedValueOnce({
        id: REQUESTER_ID,
        publicId: 'usr_pub_r',
        profiles: [profile({ maritalStatus: null, hasChildren: null })],
      });
      const [item] = await service.getIncomingRequests(TARGET_ID);
      expect(item.requester?.profile).toMatchObject({ maritalStatus: null, hasChildren: null, childrenCount: null });
    });

    it('incoming items with a requester that has no profile row yield profile null', async () => {
      db.select.mockReturnValueOnce(chain([row]));
      db.query.users.findFirst.mockResolvedValueOnce({ id: REQUESTER_ID, publicId: 'usr_pub_r', profiles: [] });
      const [item] = await service.getIncomingRequests(TARGET_ID);
      expect(item.requester).toEqual({ publicId: 'usr_pub_r', profile: null });
    });

    it('outgoing items carry none of the marital fields', async () => {
      db.select.mockReturnValueOnce(chain([row]));
      db.query.users.findFirst.mockResolvedValueOnce({
        id: TARGET_ID,
        publicId: 'usr_pub_t',
        profiles: [profile({ maritalStatus: 'DIVORCED', hasChildren: true, childrenCount: 2 })],
      });
      const [item] = await service.getOutgoingRequests(REQUESTER_ID);
      for (const k of MARITAL_KEYS) expect(item.target?.profile).not.toHaveProperty(k);
    });

    it.each([
      ['declined', { status: 'DENIED' }],
      ['lapsed', { status: 'PENDING', expiresAt: PAST }],
      ['expired', { status: 'EXPIRED' }],
    ])('hides a %s request from the receiver', async (_name, over) => {
      db.select.mockReturnValueOnce(chain([{ ...row, ...over }]));
      await expect(service.getIncomingRequests(TARGET_ID)).resolves.toEqual([]);
    });

    it('keeps an approved request in the receiver list', async () => {
      db.select.mockReturnValueOnce(chain([{ ...row, status: 'APPROVED' }]));
      db.query.users.findFirst.mockResolvedValueOnce({ id: REQUESTER_ID, publicId: 'usr_pub_r', profiles: [profile()] });
      await expect(service.getIncomingRequests(TARGET_ID)).resolves.toHaveLength(1);
    });

    it('reports a lapsed request to its sender as expired', async () => {
      db.select.mockReturnValueOnce(chain([{ ...row, expiresAt: PAST }]));
      const [item] = await service.getOutgoingRequests(REQUESTER_ID);
      expect(item.status).toBe('EXPIRED');
    });

    it('never returns the legacy one-time token', async () => {
      db.select.mockReturnValueOnce(chain([{ ...row, oneTimeToken: 'secret' }]));
      const [outgoing] = await service.getOutgoingRequests(REQUESTER_ID);
      expect(outgoing).not.toHaveProperty('oneTimeToken');
      db.select.mockReturnValueOnce(chain([{ ...row, oneTimeToken: 'secret' }]));
      const [incoming] = await service.getIncomingRequests(TARGET_ID);
      expect(incoming).not.toHaveProperty('oneTimeToken');
    });

    it('carries the contact state on outgoing rows', async () => {
      db.select.mockReturnValueOnce(chain([{ ...row, status: 'APPROVED', contactExpiresAt: FUTURE }]));
      const [item] = await service.getOutgoingRequests(REQUESTER_ID);
      expect(item.contactState).toBe('AVAILABLE');
    });
  });

  describe('respondToRequest', () => {
    const pending = { id: 'req-1', requesterId: REQUESTER_ID, targetId: TARGET_ID, status: 'PENDING', expiresAt: FUTURE };
    const requester = { id: REQUESTER_ID, email: 'r@example.com', profiles: [profile({ firstName: 'Omar' })] };
    const target = (over = {}, profileOver = {}) => ({
      id: TARGET_ID,
      email: 't@example.com',
      phone: '+13125550199',
      isPhoneVerified: true,
      profiles: [profile({ firstName: 'Fatima', ...profileOver })],
      ...over,
    });

    function arrange(targetRow: unknown, requesterRow: unknown = requester) {
      db.select.mockReturnValueOnce(chain([pending]));
      db.query.users.findFirst.mockResolvedValueOnce(requesterRow).mockResolvedValueOnce(targetRow);
    }

    it('emails a link and no contact values', async () => {
      arrange(target());
      await service.respondToRequest(TARGET_ID, 'req-1', { approved: true });
      expect(email.sendContactLinkEmail).toHaveBeenCalledWith('r@example.com', 'Omar', 'Fatima', 'req-1', 7);
      expect(JSON.stringify(email.sendContactLinkEmail.mock.calls)).not.toContain('+13125550199');
    });

    it('does not reveal a hidden name in the email', async () => {
      arrange(target({}, { publicFields: { hideName: true } }));
      await service.respondToRequest(TARGET_ID, 'req-1', { approved: true });
      expect(email.sendContactLinkEmail.mock.calls[0][2]).toBe('A member');
    });

    it('skips the email for a phone-first requester', async () => {
      arrange(target(), { ...requester, emailIsPlaceholder: true });
      await service.respondToRequest(TARGET_ID, 'req-1', { approved: true });
      expect(email.sendContactLinkEmail).not.toHaveBeenCalled();
    });

    it('stores the chosen source and a contact expiry', async () => {
      arrange(target({}, { biodataJsonEnc: GUARDIAN }));
      const set = jest.fn(() => chain([]));
      db.update.mockReturnValueOnce({ set });
      await service.respondToRequest(TARGET_ID, 'req-1', { approved: true, shareSource: 'GUARDIAN' });
      expect(set.mock.calls[0]).toEqual([
        expect.objectContaining({ shareSource: 'GUARDIAN', contactExpiresAt: expect.any(String) }),
      ]);
    });

    it('refuses guardian sharing when no guardian is saved', async () => {
      arrange(target());
      await expect(
        service.respondToRequest(TARGET_ID, 'req-1', { approved: true, shareSource: 'GUARDIAN' }),
      ).rejects.toThrow('No guardian contact is saved on this profile.');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('treats the pre-filled bare country code as no guardian phone', async () => {
      arrange(target({}, { biodataJsonEnc: JSON.stringify({ guardianPhone: '+1 ' }) }));
      await expect(
        service.respondToRequest(TARGET_ID, 'req-1', { approved: true, shareSource: 'GUARDIAN' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses own-contact sharing when nothing is verified', async () => {
      arrange(target({ isPhoneVerified: false, emailIsPlaceholder: true }));
      await expect(service.respondToRequest(TARGET_ID, 'req-1', { approved: true })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses sharing only an email address nobody has proved they own', async () => {
      arrange(target({ emailVerified: false }));
      await expect(
        service.respondToRequest(TARGET_ID, 'req-1', { approved: true, shareItems: ['email'] }),
      ).rejects.toThrow('There is no verified contact to share on this account.');
    });
  });

  describe('revealContact', () => {
    const approved = {
      id: 'req-1',
      requesterId: REQUESTER_ID,
      targetId: TARGET_ID,
      status: 'APPROVED',
      allowedShares: ['phone', 'email'],
      shareSource: 'SELF',
      contactExpiresAt: FUTURE,
      tokenUsedAt: null,
    };
    const target = {
      id: TARGET_ID,
      email: 't@example.com',
      emailVerified: true,
      phone: '+13125550199',
      isPhoneVerified: true,
      profiles: [profile({ biodataJsonEnc: GUARDIAN })],
    };

    /** select #1 -> the request, #2 -> block check. */
    function arrange(row: unknown, { blocked = false, targetRow = target as unknown, claimed = true } = {}) {
      db.select
        .mockReturnValueOnce(chain([row]))
        .mockReturnValueOnce(chain(blocked ? [{ id: 'b' }] : []));
      db.query.users.findFirst.mockResolvedValueOnce(targetRow);
      db.update.mockReturnValueOnce(chain(claimed ? [{ id: 'req-1' }] : []));
    }

    it('returns the member own contact once', async () => {
      arrange(approved);
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).resolves.toEqual({
        phone: '+13125550199',
        email: 't@example.com',
      });
      expect(audit.logInfoRequest).toHaveBeenCalledWith(REQUESTER_ID, 'CONTACT_VIEWED', TARGET_ID, 'req-1');
    });

    it('withholds an email address nobody has proved they own', async () => {
      arrange(approved, { targetRow: { ...target, emailVerified: false } });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).resolves.toEqual({ phone: '+13125550199' });
    });

    it('returns the guardian contact, not the member', async () => {
      arrange({ ...approved, shareSource: 'GUARDIAN' });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).resolves.toEqual({
        name: 'Sara',
        phone: '+1 312 555 0100',
        email: 'sara@example.com',
      });
    });

    it('refuses a second view', async () => {
      arrange({ ...approved, tokenUsedAt: PAST });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toBeInstanceOf(GoneException);
    });

    it('refuses the loser of a race', async () => {
      arrange(approved, { claimed: false });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toBeInstanceOf(GoneException);
    });

    it('refuses an expired link', async () => {
      arrange({ ...approved, contactExpiresAt: PAST });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toThrow('expired');
    });

    it('404s for anyone but the requester', async () => {
      arrange(approved);
      await expect(service.revealContact(TARGET_ID, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['PENDING', 'DENIED', 'EXPIRED'])('404s for a %s request', async (status) => {
      arrange({ ...approved, status });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses without using the view after a block', async () => {
      arrange(approved, { blocked: true });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toBeInstanceOf(GoneException);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('refuses when the target is suspended', async () => {
      arrange(approved, { targetRow: { ...target, suspendedAt: PAST } });
      await expect(service.revealContact(REQUESTER_ID, 'req-1')).rejects.toBeInstanceOf(GoneException);
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
