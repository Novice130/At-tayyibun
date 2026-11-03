import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { createDbMock } from '../../test/drizzle-mock';

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
