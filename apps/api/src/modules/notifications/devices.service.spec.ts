import { DevicesService, MAX_DEVICE_TOKENS_PER_USER } from './devices.service';
import { DrizzleService } from '../../db/drizzle.service';
import { chain, createDbMock, recordingChain, renderSql } from '../../test/drizzle-mock';

describe('DevicesService', () => {
  let db: ReturnType<typeof createDbMock>;
  let service: DevicesService;

  beforeEach(() => {
    db = createDbMock();
    service = new DevicesService({ db } as unknown as DrizzleService);
  });

  describe('register', () => {
    it('upserts by token, moving it to the caller', async () => {
      const calls: Record<string, unknown[][]> = {};
      db.insert.mockReturnValueOnce(recordingChain([], calls));
      await expect(service.register('user-1', 'tok-1', 'android')).resolves.toEqual({ success: true });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(calls.values[0][0]).toEqual(
        expect.objectContaining({ userId: 'user-1', token: 'tok-1', platform: 'android', id: expect.any(String) }),
      );
      const upsert = calls.onConflictDoUpdate[0][0] as { set: Record<string, unknown> };
      expect(upsert.set).toEqual(expect.objectContaining({ userId: 'user-1', platform: 'android' }));
    });

    it(`keeps at most ${MAX_DEVICE_TOKENS_PER_USER} devices, dropping the least recently registered`, async () => {
      const selectCalls: Record<string, unknown[][]> = {};
      db.select.mockReturnValueOnce(recordingChain([{ id: 'old-1' }, { id: 'old-2' }], selectCalls));
      const deleteCalls: Record<string, unknown[][]> = {};
      db.delete.mockReturnValueOnce(recordingChain([], deleteCalls));

      await service.register('user-1', 'tok-new', 'ios');

      expect(selectCalls.offset[0][0]).toBe(MAX_DEVICE_TOKENS_PER_USER);
      expect(renderSql(selectCalls.orderBy[0][0]).sql).toContain('"updated_at" desc');
      const where = renderSql(deleteCalls.where[0][0]);
      expect(where.sql).toContain('"device_tokens"."id" in');
      expect(where.params).toEqual(['old-1', 'old-2']);
    });

    it('deletes nothing while under the cap', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await service.register('user-1', 'tok-1', 'android');
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  it('unregister only touches the caller’s own token', async () => {
    const calls: Record<string, unknown[][]> = {};
    db.delete.mockReturnValueOnce(recordingChain([], calls));
    await expect(service.unregister('user-1', 'tok-1')).resolves.toEqual({ success: true });
    const where = renderSql(calls.where[0][0]);
    expect(where.sql).toContain('"device_tokens"."user_id" = $');
    expect(where.sql).toContain('"device_tokens"."token" = $');
    expect(where.params).toEqual(expect.arrayContaining(['user-1', 'tok-1']));
  });

  it('tokensFor skips suspended members', async () => {
    const calls: Record<string, unknown[][]> = {};
    db.select.mockReturnValueOnce(recordingChain([{ token: 'a' }, { token: 'b' }], calls));
    await expect(service.tokensFor('user-1')).resolves.toEqual(['a', 'b']);
    expect(renderSql(calls.where[0][0]).sql).toContain('"users"."suspended_at" is null');
  });

  it('removeTokens is a no-op for an empty list', async () => {
    await service.removeTokens([]);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
