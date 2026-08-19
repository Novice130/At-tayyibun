import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../../db/drizzle.service';
import { blocks, reports, infoRequests, users, photos, skipReasons, messages, emailCampaigns, auditLogs } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { StorageService } from '../../services/storage.service';
import { ReportReason, ReportStatus, RequestStatus } from '../../common/types/role';

const REPORT_REASONS = Object.values(ReportReason);

@Injectable()
export class ModerationService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  /** True when either user has blocked the other. Blocking is symmetric. */
  async isBlocked(aUserId: string, bUserId: string): Promise<boolean> {
    const rows = await this.drizzle.db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, aUserId), eq(blocks.blockedId, bUserId)),
          and(eq(blocks.blockerId, bUserId), eq(blocks.blockedId, aUserId)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  private async resolveUserByPublicId(publicId: string) {
    const [user] = await this.drizzle.db
      .select({ id: users.id, publicId: users.publicId, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.publicId, publicId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async block(blockerId: string, targetPublicId: string) {
    const db = this.drizzle.db;
    const target = await this.resolveUserByPublicId(targetPublicId);
    if (target.id === blockerId) throw new BadRequestException('You cannot block yourself');

    // Idempotent insert — the pair unique index makes a repeat block a no-op.
    await db
      .insert(blocks)
      .values({ id: randomUUID(), blockerId, blockedId: target.id })
      .onConflictDoNothing();

    // Hard-cancel any pending requests in either direction: a block makes the
    // connection void, and the partial unique index frees the requester's slot.
    await db
      .update(infoRequests)
      .set({ status: RequestStatus.EXPIRED as any, respondedAt: new Date().toISOString() })
      .where(
        and(
          eq(infoRequests.status, RequestStatus.PENDING as any),
          or(
            and(eq(infoRequests.requesterId, blockerId), eq(infoRequests.targetId, target.id)),
            and(eq(infoRequests.requesterId, target.id), eq(infoRequests.targetId, blockerId)),
          ),
        ),
      );

    await this.auditService.log({
      userId: blockerId,
      action: 'USER_BLOCKED',
      resourceType: 'user',
      resourceId: target.id,
      metadata: { targetPublicId },
    });

    return { success: true };
  }

  async unblock(blockerId: string, targetPublicId: string) {
    const target = await this.resolveUserByPublicId(targetPublicId);
    await this.drizzle.db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, target.id)));
    await this.auditService.log({
      userId: blockerId,
      action: 'USER_UNBLOCKED',
      resourceType: 'user',
      resourceId: target.id,
      metadata: { targetPublicId },
    });
    return { success: true };
  }

  async listBlocks(blockerId: string) {
    const rows = await this.drizzle.db
      .select({
        createdAt: blocks.createdAt,
        publicId: users.publicId,
        name: users.name,
        email: users.email,
      })
      .from(blocks)
      .innerJoin(users, eq(blocks.blockedId, users.id))
      .where(eq(blocks.blockerId, blockerId))
      .orderBy(desc(blocks.createdAt));

    return rows.map((r) => ({
      targetPublicId: r.publicId,
      name: r.name,
      email: r.email,
      createdAt: r.createdAt,
    }));
  }

  async report(reporterId: string, targetPublicId: string, reason: string, details?: string) {
    if (!REPORT_REASONS.includes(reason as ReportReason)) {
      throw new BadRequestException('Invalid report reason');
    }

    const db = this.drizzle.db;
    const target = await this.resolveUserByPublicId(targetPublicId);
    if (target.id === reporterId) throw new BadRequestException('You cannot report yourself');

    // 10/day/user self-service limit — the eleventh report is rejected here.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [count] = await db
      .select({ value: sql<number>`COUNT(*)` })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, reporterId),
          sql`${reports.createdAt} >= ${dayStart.toISOString()}`,
        ),
      );
    if (Number(count.value) >= 10) {
      throw new ForbiddenException('Daily report limit reached. Please try again tomorrow.');
    }

    const [report] = await db
      .insert(reports)
      .values({
        id: randomUUID(),
        reporterId,
        reportedUserId: target.id,
        reason: reason as ReportReason,
        details: details?.substring(0, 500) ?? null,
      })
      .returning();

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@attayyibun.com');
    try {
      await this.emailService.sendEmail({
        to: adminEmail,
        subject: `[Moderation] New ${reason} report`,
        html: `<p>A new report was filed:</p>
               <ul>
                 <li><strong>Reason:</strong> ${reason}</li>
                 <li><strong>Reported user:</strong> ${target.publicId}</li>
                 <li><strong>Details:</strong> ${details ?? '—'}</li>
               </ul>
               <p>Review it in the admin panel. Guideline 1.2 requires action within 24 hours.</p>`,
      });
    } catch (error) {
      console.error('Failed to send report notification email:', error);
    }

    await this.auditService.log({
      userId: reporterId,
      action: 'REPORT_SUBMITTED',
      resourceType: 'report',
      resourceId: report.id,
      metadata: { targetPublicId, reason },
    });

    return { success: true, id: report.id };
  }

  // ---- admin side ----

  async listReports(status?: string) {
    const conds = status ? [eq(reports.status, status as ReportStatus)] : [];
    return this.drizzle.db
      .select({
        id: reports.id,
        reporterId: reports.reporterId,
        reportedUserId: reports.reportedUserId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        reviewedBy: reports.reviewedBy,
        reviewedAt: reports.reviewedAt,
        reporter: {
          publicId: users.publicId,
          email: users.email,
        },
      })
      .from(reports)
      .leftJoin(users, eq(reports.reporterId, users.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(reports.createdAt))
      .limit(100);
  }

  async resolveReport(
    adminId: string,
    reportId: string,
    action: 'DISMISS' | 'SUSPEND_USER' | 'DELETE_USER',
    note?: string,
  ) {
    const db = this.drizzle.db;
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('This report has already been resolved');
    }

    if (action !== 'DISMISS' && report.reportedUserId) {
      if (action === 'SUSPEND_USER') {
        await db.update(users).set({ isVerified: false }).where(eq(users.id, report.reportedUserId));
      } else {
        await this.hardDeleteUser(report.reportedUserId, adminId);
      }
    }

    await db
      .update(reports)
      .set({
        status: (action === 'DISMISS' ? ReportStatus.DISMISSED : ReportStatus.ACTIONED) as ReportStatus,
        reviewedBy: adminId,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(reports.id, reportId));

    await this.auditService.logAdminAction(adminId, 'REPORT_RESOLVED', 'report', reportId, {
      action,
      note: note ?? null,
      reportedUserId: report.reportedUserId,
    });

    return { success: true };
  }

  /**
   * Complete immediate deletion of a user. Shared by self-serve deletion (A4)
   * and admin report actioning. FK-safe order matters — several tables
   * reference users with onDelete "restrict" and must be cleared first.
   */
  async hardDeleteUser(userId: string, deletedBy: string) {
    const db = this.drizzle.db;

    // Delete GCS objects while the rows still exist — the paths die with them.
    const userPhotos = await db.select().from(photos).where(eq(photos.userId, userId));
    for (const photo of userPhotos) {
      for (const path of [photo.gcsOriginalPath, photo.gcsThumbnailPath, photo.gcsDisplayPath]) {
        if (path) {
          try {
            await this.storageService.deleteFile(path);
          } catch (error) {
            console.error('GCS delete failed:', path, error);
          }
        }
      }
    }

    await db.transaction(async (tx) => {
      // onDelete restrict → explicit deletes first.
      await tx.delete(infoRequests).where(or(eq(infoRequests.requesterId, userId), eq(infoRequests.targetId, userId)));
      await tx.delete(skipReasons).where(or(eq(skipReasons.requesterId, userId), eq(skipReasons.targetId, userId)));
      await tx.delete(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)));
      await tx.delete(emailCampaigns).where(eq(emailCampaigns.createdById, userId));
      // blocks cascade from users; reports set-null. Nothing to do here.

      // Audit BEFORE the users row disappears: the FK is set-null, so the
      // row survives, but the context of who was deleted lives in metadata.
      await tx.insert(auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'ACCOUNT_DELETED',
        resourceType: 'user',
        resourceId: userId,
        metadata: { deletedBy },
      });

      // two_factor, session, account, profiles, photos all cascade.
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
}
