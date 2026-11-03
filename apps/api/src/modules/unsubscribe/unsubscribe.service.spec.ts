import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnsubscribeService } from './unsubscribe.service';
import { EncryptionService } from '../../services/encryption.service';
import { DrizzleService } from '../../db/drizzle.service';
import { AuditService } from '../../services/audit.service';
import { chain, createDbMock } from '../../test/drizzle-mock';

const config = new ConfigService({ ENCRYPTION_KEY: 'a'.repeat(64), WEB_URL: 'https://example.test/' });

describe('UnsubscribeService', () => {
  let db: ReturnType<typeof createDbMock>;
  let audit: { log: jest.Mock };
  let service: UnsubscribeService;

  beforeEach(() => {
    db = createDbMock();
    audit = { log: jest.fn(async () => undefined) };
    service = new UnsubscribeService(
      { db } as unknown as DrizzleService,
      new EncryptionService(config),
      audit as unknown as AuditService,
      config,
    );
  });

  it('builds the page and one-click URLs without a double slash', () => {
    expect(service.pageUrl('pub1')).toMatch(/^https:\/\/example\.test\/unsubscribe\?token=pub1\./);
    expect(service.oneClickUrl('pub1')).toMatch(/^https:\/\/example\.test\/api\/unsubscribe\?token=pub1\./);
  });

  it('records the opt-out and audits it once', async () => {
    db.select.mockReturnValueOnce(chain([{ id: 'user-1' }]));
    db.insert.mockReturnValueOnce(chain([{ id: 'unsub-1' }]));
    await expect(service.unsubscribe(service.tokenFor('pub1'))).resolves.toEqual({ success: true });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a repeat succeeds without a second audit row', async () => {
    db.select.mockReturnValueOnce(chain([{ id: 'user-1' }]));
    db.insert.mockReturnValueOnce(chain([]));
    await expect(service.unsubscribe(service.tokenFor('pub1'))).resolves.toEqual({ success: true });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it.each([
    ['tampered signature', () => `${service.tokenFor('pub1')}x`],
    ['another member under my signature', () => `pub2.${service.tokenFor('pub1').split('.')[1]}`],
    ['no signature', () => 'pub1'],
    ['empty', () => ''],
    ['missing', () => undefined],
    ['repeated query param', () => [service.tokenFor('pub1')]],
  ])('rejects %s and writes nothing', async (_name, token) => {
    await expect(service.unsubscribe(token())).rejects.toBeInstanceOf(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects a valid signature for a deleted member', async () => {
    db.select.mockReturnValueOnce(chain([]));
    await expect(service.unsubscribe(service.tokenFor('gone'))).rejects.toBeInstanceOf(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('signatures are not usable for another purpose', () => {
    const encryption = new EncryptionService(config);
    expect(encryption.signFor('other', 'pub1')).not.toBe(encryption.signFor('unsubscribe/v1', 'pub1'));
  });
});
