import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  CAMPAIGN_DISPATCH_VERSION,
  campaignRecipientsQuery,
  EmailCampaignProcessor,
} from './email-campaign.processor';
import { AdminModule } from '../admin.module';
import { POSTAL_ADDRESS_MISSING } from '../../../services/email.service';
import { chain, createDbMock, recordingChain, renderSql } from '../../../test/drizzle-mock';

const CAMPAIGN = { id: 'c1', subject: 'News', template: '<p>Hi</p>', status: 'SENDING', targetAudience: {} };
const MEMBER = { id: 'u1', publicId: 'pub1', email: 'm@example.com' };

function job(data: Record<string, unknown>) {
  return { id: 'job-1', data } as any;
}
const current = { campaignId: 'c1', dispatchVersion: CAMPAIGN_DISPATCH_VERSION };

describe('EmailCampaignProcessor', () => {
  let db: ReturnType<typeof createDbMock>;
  let email: { postalAddress: string | null; sendCampaignEmail: jest.Mock };
  let processor: EmailCampaignProcessor;
  let links: jest.Mock;

  beforeEach(() => {
    db = createDbMock();
    email = { postalAddress: '1 Main St', sendCampaignEmail: jest.fn(async () => undefined) };
    links = jest.fn((p: string) => ({ pageUrl: `page:${p}`, oneClickUrl: `click:${p}` }));
    processor = new EmailCampaignProcessor(email as any, { db } as any, { linksFor: links } as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('is registered in AdminModule', () => {
    expect(Reflect.getMetadata('providers', AdminModule)).toContain(EmailCampaignProcessor);
  });

  it.each([
    ['no version', { campaignId: 'c1', subject: 's', audience: {} }],
    ['an older version', { campaignId: 'c1', dispatchVersion: 1 }],
  ])('discards a queued job with %s: no send, back to DRAFT', async (_name, data) => {
    const calls: Record<string, unknown[][]> = {};
    db.update.mockReturnValueOnce(recordingChain([], calls));
    await expect(processor.process(job(data))).resolves.toEqual({ skipped: 'legacy-job' });
    expect(email.sendCampaignEmail).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
    expect(calls.set[0][0]).toEqual({ status: 'DRAFT' });
    expect(renderSql(calls.where[0][0]).params).toEqual(['c1', 'SENDING']);
  });

  it.each(['DRAFT', 'SENT'])('does nothing for a campaign already %s', async (status) => {
    db.select.mockReturnValueOnce(chain([{ ...CAMPAIGN, status }]));
    await expect(processor.process(job(current))).resolves.toEqual({ skipped: 'not-sending' });
    expect(email.sendCampaignEmail).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('fails clearly without a postal address, before reading recipients', async () => {
    email.postalAddress = null;
    db.select.mockReturnValueOnce(chain([CAMPAIGN]));
    await expect(processor.process(job(current))).rejects.toThrow(POSTAL_ADDRESS_MISSING);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(email.sendCampaignEmail).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  function arrangeSend(recipients: unknown[], sentCount: number) {
    db.select
      .mockReturnValueOnce(chain([CAMPAIGN]))
      .mockReturnValueOnce(chain(recipients))
      .mockReturnValueOnce(chain([{ value: sentCount }]));
  }

  it('sends through the compliant path using the stored campaign', async () => {
    arrangeSend([MEMBER], 1);
    db.insert.mockReturnValueOnce(chain([{ id: 'claim-1' }]));
    await expect(processor.process(job({ ...current, subject: 'stale' }))).resolves.toEqual({ successCount: 1, total: 1 });
    expect(email.sendCampaignEmail).toHaveBeenCalledWith({
      to: 'm@example.com',
      subject: 'News',
      html: '<p>Hi</p>',
      unsubscribeUrl: 'page:pub1',
      oneClickUrl: 'click:pub1',
      idempotencyKey: 'campaign/c1/u1',
    });
  });

  it('skips a member already claimed by an earlier run of this job', async () => {
    arrangeSend([MEMBER], 1);
    db.insert.mockReturnValueOnce(chain([]));
    await processor.process(job(current));
    expect(email.sendCampaignEmail).not.toHaveBeenCalled();
  });

  it('uses a key built from campaign and member, so a retry cannot double-send', async () => {
    arrangeSend([MEMBER], 1);
    db.insert.mockReturnValueOnce(chain([{ id: 'claim-1' }]));
    await processor.process(job(current));
    expect(email.sendCampaignEmail.mock.calls[0][0].idempotencyKey).toBe('campaign/c1/u1');
  });

  it('one failure does not stop the rest, and is not counted as sent', async () => {
    arrangeSend([MEMBER, { ...MEMBER, id: 'u2', publicId: 'pub2' }], 1);
    db.insert
      .mockReturnValueOnce(chain([{ id: 'claim-1' }]))
      .mockReturnValueOnce(chain([{ id: 'claim-2' }]));
    email.sendCampaignEmail.mockRejectedValueOnce(new Error('rate limited'));
    await expect(processor.process(job(current))).resolves.toEqual({ successCount: 1, total: 2 });
    expect(email.sendCampaignEmail).toHaveBeenCalledTimes(2);
    // Only the second recipient is marked sent, then the campaign itself.
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('signs each recipient token once, not once per link', async () => {
    arrangeSend([MEMBER, { ...MEMBER, id: 'u2', publicId: 'pub2' }], 2);
    db.insert
      .mockReturnValueOnce(chain([{ id: 'claim-1' }]))
      .mockReturnValueOnce(chain([{ id: 'claim-2' }]));
    await processor.process(job(current));
    expect(links.mock.calls).toEqual([['pub1'], ['pub2']]);
  });

  it.each([
    ['reading recipients', () => {
      db.select.mockReturnValueOnce(chain([CAMPAIGN])).mockImplementationOnce(() => { throw new Error('db down'); });
    }],
    ['claiming a recipient', () => {
      db.select.mockReturnValueOnce(chain([CAMPAIGN])).mockReturnValueOnce(chain([MEMBER]));
      db.insert.mockImplementationOnce(() => { throw new Error('db down'); });
    }],
  ])('a failure while %s returns the campaign to DRAFT and rethrows', async (_name, arrange) => {
    arrange();
    const calls: Record<string, unknown[][]> = {};
    db.update.mockReturnValueOnce(recordingChain([], calls));
    await expect(processor.process(job(current))).rejects.toThrow('db down');
    expect(calls.set[0][0]).toEqual({ status: 'DRAFT' });
    expect(renderSql(calls.where[0][0]).params).toEqual(['c1', 'SENDING']);
  });

  it('a re-dispatch after a failure skips everyone already claimed', async () => {
    // Members claimed on the first run conflict on (campaign, user) and get nothing.
    arrangeSend([MEMBER, { ...MEMBER, id: 'u2', publicId: 'pub2', email: 'n@example.com' }], 2);
    db.insert.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ id: 'claim-2' }]));
    await processor.process(job(current));
    expect(email.sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(email.sendCampaignEmail.mock.calls[0][0].to).toBe('n@example.com');
  });

  describe('recipient query', () => {
    const toSql = (audience: any) => campaignRecipientsQuery(drizzle.mock(), audience).toSQL();

    it('excludes unsubscribed members and placeholder addresses', () => {
      const { sql } = toSql({});
      expect(sql).toContain('left join "unsubscribes" on "unsubscribes"."user_id" = "users"."id"');
      expect(sql).toContain('"unsubscribes"."id" is null');
      expect(sql).toContain('"users"."email_is_placeholder" = $');
    });

    it('excludes suspended members', () => {
      expect(toSql({}).sql).toContain('"users"."suspended_at" is null');
    });

    it('applies the audience filters', () => {
      const { sql, params } = toSql({ roles: ['USER'], membershipTiers: ['GOLD'] });
      expect(sql).toContain('"users"."role" in');
      expect(sql).toContain('"users"."membership_tier" in');
      expect(params).toEqual(expect.arrayContaining(['USER', 'GOLD']));
    });
  });
});
