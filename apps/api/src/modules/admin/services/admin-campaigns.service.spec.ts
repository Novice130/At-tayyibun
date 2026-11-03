import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminCampaignsService } from './admin-campaigns.service';
import { CAMPAIGN_DISPATCH_VERSION } from '../processors/email-campaign.processor';
import { POSTAL_ADDRESS_MISSING } from '../../../services/email.service';
import { chain, createDbMock, recordingChain, renderSql } from '../../../test/drizzle-mock';

describe('AdminCampaignsService.dispatchCampaign', () => {
  let db: ReturnType<typeof createDbMock>;
  let queue: { add: jest.Mock };
  let email: { postalAddress: string | null };
  let service: AdminCampaignsService;

  beforeEach(() => {
    db = createDbMock();
    queue = { add: jest.fn(async () => undefined) };
    email = { postalAddress: '1 Main St' };
    service = new AdminCampaignsService(
      { db } as any,
      { logAdminAction: jest.fn(async () => undefined) } as any,
      queue as any,
      email as any,
    );
  });

  it('refuses without a postal address, leaving the campaign and queue untouched', async () => {
    email.postalAddress = null;
    const err = await service.dispatchCampaign('a1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe(POSTAL_ADDRESS_MISSING);
    expect(db.update).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('claims DRAFT -> SENDING in the WHERE, then queues a versioned job', async () => {
    const calls: Record<string, unknown[][]> = {};
    db.update.mockReturnValueOnce(recordingChain([{ id: 'c1' }], calls));
    await expect(service.dispatchCampaign('a1', 'c1')).resolves.toMatchObject({ success: true });
    expect(renderSql(calls.where[0][0]).params).toEqual(['c1', 'DRAFT']);
    expect(queue.add.mock.calls[0][1]).toEqual({ campaignId: 'c1', dispatchVersion: CAMPAIGN_DISPATCH_VERSION });
  });

  it('a double dispatch queues nothing', async () => {
    db.update.mockReturnValueOnce(chain([]));
    db.select.mockReturnValueOnce(chain([{ id: 'c1', status: 'SENDING' }]));
    await expect(service.dispatchCampaign('a1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('404s on an unknown campaign', async () => {
    db.update.mockReturnValueOnce(chain([]));
    db.select.mockReturnValueOnce(chain([]));
    await expect(service.dispatchCampaign('a1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the campaign to DRAFT if queueing fails', async () => {
    db.update.mockReturnValueOnce(chain([{ id: 'c1' }]));
    const calls: Record<string, unknown[][]> = {};
    db.update.mockReturnValueOnce(recordingChain([], calls));
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.dispatchCampaign('a1', 'c1')).rejects.toThrow('redis down');
    expect(calls.set[0][0]).toEqual({ status: 'DRAFT' });
  });
});
