import { NotFoundException } from '@nestjs/common';
import { AdminService, NUDGE_BATCH, NUDGE_TIME_BUDGET_MS } from './admin.service';
import { chain, createDbMock, recordingChain, renderSql } from '../../test/drizzle-mock';

// Anything that could be used to log in as, or impersonate, the user.
const CREDENTIAL_COLUMNS = ['passwordHash', 'emailVerificationToken', 'emailVerificationExpiry'];
// Encrypted or otherwise private profile columns the inspector never reads.
const PRIVATE_PROFILE_COLUMNS = ['lastNameEnc', 'bioEnc', 'biodataJsonEnc'];

describe('AdminService.getUser', () => {
  let db: ReturnType<typeof createDbMock>;
  let service: AdminService;

  beforeEach(() => {
    db = createDbMock();
    service = new (AdminService as any)({ db }, {}, {}, {}, {});
  });

  const queryArgs = () => db.query.users.findFirst.mock.calls[0][0];

  it('selects an allowlist with no credential column', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({ id: 'u1', profiles: [] });
    await service.getUser('u1');

    const { columns } = queryArgs();
    expect(columns).toBeDefined();
    for (const column of CREDENTIAL_COLUMNS) expect(columns).not.toHaveProperty(column);
    expect(columns).toEqual(expect.objectContaining({ id: true, email: true, role: true }));
  });

  it('keeps private profile columns out of the relation', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({ id: 'u1', profiles: [] });
    await service.getUser('u1');

    const profileColumns = queryArgs().with.profiles.columns;
    expect(profileColumns).toEqual({ firstName: true });
    for (const column of PRIVATE_PROFILE_COLUMNS) expect(profileColumns).not.toHaveProperty(column);
  });

  it('flattens the profile relation for the inspector', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({ id: 'u1', profiles: [{ firstName: 'Omar' }] });
    await expect(service.getUser('u1')).resolves.toEqual({ id: 'u1', profile: { firstName: 'Omar' } });
  });

  it('throws when the user does not exist', async () => {
    await expect(service.getUser('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService.nudgeAllIncomplete', () => {
  let db: ReturnType<typeof createDbMock>;
  let email: { sendVerifyPhoneNudgeEmail: jest.Mock };
  let audit: { logAdminAction: jest.Mock };
  let service: AdminService;
  const member = (n: number) => ({ id: `u${n}`, email: `m${n}@example.com`, name: `Member ${n}` });

  beforeEach(() => {
    db = createDbMock();
    email = { sendVerifyPhoneNudgeEmail: jest.fn(async () => undefined) };
    audit = { logAdminAction: jest.fn(async () => undefined) };
    service = new (AdminService as any)({ db }, audit, email, {}, {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('skips members nudged in the last 24 hours and caps the batch', async () => {
    const calls: Record<string, unknown[][]> = {};
    db.select.mockReturnValueOnce(recordingChain([], calls));
    await service.nudgeAllIncomplete('admin');

    const where = renderSql(calls.where[0][0]);
    expect(where.sql).toContain('not exists');
    expect(where.sql).toContain('"audit_logs"."resource_id" = "users"."id"');
    expect(where.sql).toContain("interval '24 hours'");
    expect(calls.limit[0][0]).toBe(NUDGE_BATCH + 1);
  });

  it('sends one batch and says more remain', async () => {
    const rows = Array.from({ length: NUDGE_BATCH + 1 }, (_, i) => member(i));
    db.select.mockReturnValueOnce(chain(rows));
    const res = await service.nudgeAllIncomplete('admin');

    expect(email.sendVerifyPhoneNudgeEmail).toHaveBeenCalledTimes(NUDGE_BATCH);
    expect(audit.logAdminAction).toHaveBeenCalledTimes(NUDGE_BATCH);
    expect(res).toEqual({ total: NUDGE_BATCH, sent: NUDGE_BATCH, failed: [], more: true });
  });

  it('stops starting sends once the time budget is spent', async () => {
    db.select.mockReturnValueOnce(chain([member(1), member(2), member(3)]));
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    email.sendVerifyPhoneNudgeEmail.mockImplementation(async () => {
      now += NUDGE_TIME_BUDGET_MS; // the first send uses up the whole budget
    });
    const res = await service.nudgeAllIncomplete('admin');

    expect(email.sendVerifyPhoneNudgeEmail).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ total: 2, sent: 2, more: true });
  });

  it('reports no more when the last batch fits', async () => {
    db.select.mockReturnValueOnce(chain([member(1)]));
    await expect(service.nudgeAllIncomplete('admin')).resolves.toEqual({ total: 1, sent: 1, failed: [], more: false });
  });
});
