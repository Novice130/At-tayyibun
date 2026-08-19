import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import { DrizzleService } from '../../db/drizzle.service';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { StorageService } from '../../services/storage.service';
import { ReportReason, ReportStatus } from '../../common/types/role';
import { chain, createDbMock } from '../../test/drizzle-mock';

const VIEWER = 'viewer-uuid';
const TARGET = { id: 'target-uuid', publicId: 'pub_target', email: 't@example.com', name: 'Target' };

describe('ModerationService', () => {
  let db: ReturnType<typeof createDbMock>;
  let audit: { log: jest.Mock; logAdminAction: jest.Mock };
  let email: { sendEmail: jest.Mock };
  let storage: { deleteFile: jest.Mock };
  let service: ModerationService;

  beforeEach(() => {
    db = createDbMock();
    audit = { log: jest.fn(), logAdminAction: jest.fn() };
    email = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    service = new ModerationService(
      { db } as unknown as DrizzleService,
      audit as unknown as AuditService,
      email as unknown as EmailService,
      storage as unknown as StorageService,
      new ConfigService({ ADMIN_EMAIL: 'admin@attayyibun.com' }),
    );
  });

  describe('isBlocked', () => {
    it('is true when a block row exists in either direction', async () => {
      db.select.mockReturnValueOnce(chain([{ id: 'block-1' }]));
      await expect(service.isBlocked(VIEWER, TARGET.id)).resolves.toBe(true);
    });

    it('is false when no block row exists', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await expect(service.isBlocked(VIEWER, TARGET.id)).resolves.toBe(false);
    });
  });

  describe('block', () => {
    it('rejects an unknown public id', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await expect(service.block(VIEWER, 'pub_missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects blocking yourself', async () => {
      db.select.mockReturnValueOnce(chain([{ ...TARGET, id: VIEWER }]));
      await expect(service.block(VIEWER, 'pub_self')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inserts the block, expires pending requests and audits', async () => {
      db.select.mockReturnValueOnce(chain([TARGET]));
      await expect(service.block(VIEWER, TARGET.publicId)).resolves.toEqual({ success: true });
      expect(db.insert).toHaveBeenCalledTimes(1);
      // Pending requests in either direction are hard-cancelled by the block.
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_BLOCKED', resourceId: TARGET.id }),
      );
    });
  });

  describe('unblock', () => {
    it('deletes the row and audits', async () => {
      db.select.mockReturnValueOnce(chain([TARGET]));
      await expect(service.unblock(VIEWER, TARGET.publicId)).resolves.toEqual({ success: true });
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_UNBLOCKED' }),
      );
    });
  });

  describe('listBlocks', () => {
    it('maps joined rows onto the public shape', async () => {
      db.select.mockReturnValueOnce(
        chain([{ createdAt: '2026-08-20T00:00:00.000Z', publicId: 'pub_a', name: 'A', email: 'a@x.com' }]),
      );
      await expect(service.listBlocks(VIEWER)).resolves.toEqual([
        { targetPublicId: 'pub_a', name: 'A', email: 'a@x.com', createdAt: '2026-08-20T00:00:00.000Z' },
      ]);
    });
  });

  describe('report', () => {
    const okInsert = () => db.insert.mockReturnValueOnce(chain([{ id: 'report-1' }]));

    it('rejects a reason outside the enum', async () => {
      await expect(service.report(VIEWER, TARGET.publicId, 'NOT_A_REASON')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('rejects reporting yourself', async () => {
      db.select.mockReturnValueOnce(chain([{ ...TARGET, id: VIEWER }]));
      await expect(service.report(VIEWER, 'pub_self', ReportReason.SPAM_OR_SCAM)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects the eleventh report of the day', async () => {
      db.select
        .mockReturnValueOnce(chain([TARGET])) // resolveUserByPublicId
        .mockReturnValueOnce(chain([{ value: 10 }])); // today's count
      await expect(service.report(VIEWER, TARGET.publicId, ReportReason.HARASSMENT)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('accepts the tenth report of the day', async () => {
      db.select.mockReturnValueOnce(chain([TARGET])).mockReturnValueOnce(chain([{ value: 9 }]));
      okInsert();
      await expect(service.report(VIEWER, TARGET.publicId, ReportReason.HARASSMENT)).resolves.toEqual({
        success: true,
        id: 'report-1',
      });
    });

    it('truncates details to 500 characters', async () => {
      db.select.mockReturnValueOnce(chain([TARGET])).mockReturnValueOnce(chain([{ value: 0 }]));
      const insertChain = chain([{ id: 'report-1' }]);
      const values = jest.fn((_v: any) => insertChain);
      db.insert.mockReturnValueOnce({ values } as any);
      await service.report(VIEWER, TARGET.publicId, ReportReason.OTHER, 'x'.repeat(900));
      expect(values.mock.calls[0][0].details).toHaveLength(500);
    });

    it('still records the report when the notification email fails', async () => {
      db.select.mockReturnValueOnce(chain([TARGET])).mockReturnValueOnce(chain([{ value: 0 }]));
      okInsert();
      email.sendEmail.mockRejectedValueOnce(new Error('SendGrid down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.report(VIEWER, TARGET.publicId, ReportReason.FAKE_PROFILE)).resolves.toEqual({
        success: true,
        id: 'report-1',
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_SUBMITTED' }));
    });
  });

  describe('resolveReport', () => {
    const ADMIN = 'admin-uuid';

    it('404s on an unknown report', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await expect(service.resolveReport(ADMIN, 'missing', 'DISMISS')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to resolve an already-resolved report', async () => {
      db.select.mockReturnValueOnce(
        chain([{ id: 'r1', status: ReportStatus.ACTIONED, reportedUserId: TARGET.id }]),
      );
      await expect(service.resolveReport(ADMIN, 'r1', 'DISMISS')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('DISMISS leaves the reported user untouched', async () => {
      db.select.mockReturnValueOnce(
        chain([{ id: 'r1', status: ReportStatus.PENDING, reportedUserId: TARGET.id }]),
      );
      const hardDelete = jest.spyOn(service, 'hardDeleteUser').mockResolvedValue(undefined);
      await expect(service.resolveReport(ADMIN, 'r1', 'DISMISS')).resolves.toEqual({ success: true });
      expect(hardDelete).not.toHaveBeenCalled();
      // Only the reports row is updated.
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('DELETE_USER hard-deletes the reported user', async () => {
      db.select.mockReturnValueOnce(
        chain([{ id: 'r1', status: ReportStatus.PENDING, reportedUserId: TARGET.id }]),
      );
      const hardDelete = jest.spyOn(service, 'hardDeleteUser').mockResolvedValue(undefined);
      await service.resolveReport(ADMIN, 'r1', 'DELETE_USER');
      expect(hardDelete).toHaveBeenCalledWith(TARGET.id, ADMIN);
    });
  });

  describe('hardDeleteUser', () => {
    it('deletes stored photo objects before the rows go', async () => {
      db.select.mockReturnValueOnce(
        chain([
          {
            gcsOriginalPath: 'orig.jpg',
            gcsThumbnailPath: 'thumb.jpg',
            gcsDisplayPath: null,
            userId: TARGET.id,
          },
        ]),
      );
      await service.hardDeleteUser(TARGET.id, TARGET.id);
      expect(storage.deleteFile).toHaveBeenCalledWith('orig.jpg');
      expect(storage.deleteFile).toHaveBeenCalledWith('thumb.jpg');
      // Null paths are skipped rather than passed through.
      expect(storage.deleteFile).toHaveBeenCalledTimes(2);
    });

    it('continues the deletion when object storage fails', async () => {
      db.select.mockReturnValueOnce(
        chain([{ gcsOriginalPath: 'orig.jpg', gcsThumbnailPath: null, gcsDisplayPath: null }]),
      );
      storage.deleteFile.mockRejectedValueOnce(new Error('GCS 500'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.hardDeleteUser(TARGET.id, TARGET.id)).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('clears restrict-FK tables and writes the audit row inside the transaction', async () => {
      db.select.mockReturnValueOnce(chain([]));
      await service.hardDeleteUser(TARGET.id, 'admin-uuid');
      // info_requests, skip_reasons, messages, email_campaigns, then users.
      expect(db.delete).toHaveBeenCalledTimes(5);
      // The ACCOUNT_DELETED audit row is inserted before the users row dies.
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });
});
