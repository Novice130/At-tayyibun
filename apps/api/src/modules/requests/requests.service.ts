import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { infoRequests, users, photos } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { StorageService } from '../../services/storage.service';
import { EncryptionService } from '../../services/encryption.service';
import { RequestStatus } from '../../common/types/role';
import { RespondRequestDto } from './dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async getUserWithProfile(where: any) {
    const user = await this.drizzle.db.query.users.findFirst({
      where,
      with: { profiles: true },
    });
    if (!user) return null;
    const profileRows = (user as any).profiles;
    return {
      ...user,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    };
  }

  async createRequest(requesterId: string, targetPublicId: string): Promise<{ id: string }> {
    const target = await this.getUserWithProfile(eq(users.publicId, targetPublicId));
    if (!target) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new BadRequestException('Cannot request your own information');

    // Both sides must have a profile before a request is worth creating. The
    // notification email below is skipped when either is missing, so without
    // this guard the row was still written — consuming the requester's single
    // pending-request slot — while the target was never told about it.
    const requester = await this.getUserWithProfile(eq(users.id, requesterId));
    if (!requester?.profile) {
      throw new BadRequestException('Please complete your profile before sending a request.');
    }
    if (!target.profile) {
      throw new BadRequestException('This member has not finished setting up their profile yet.');
    }

    const [existing] = await this.drizzle.db
      .select({ id: infoRequests.id })
      .from(infoRequests)
      .where(and(eq(infoRequests.requesterId, requesterId), eq(infoRequests.status, RequestStatus.PENDING)))
      .limit(1);

    if (existing) {
      throw new ConflictException('You already have a pending request. Please wait for a response or let it expire.');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const [request] = await this.drizzle.db
      .insert(infoRequests)
      .values({
        id: randomUUID(),
        requesterId,
        targetId: target.id,
        status: RequestStatus.PENDING as any,
        expiresAt: expiresAt.toISOString(),
        allowedShares: [],
      })
      .returning();

    try {
      await this.emailService.sendContactRequestEmail(
        target.email,
        target.profile.firstName,
        requester.profile.firstName,
        requester.profile.ethnicity,
        [requester.profile.city, requester.profile.state].filter(Boolean).join(', '),
      );
    } catch (error) {
      console.error('Failed to send contact request email:', error);
    }

    await this.auditService.logInfoRequest(requesterId, 'REQUEST_SENT', target.id, request.id);

    return { id: request.id };
  }

  async getActiveRequest(userId: string) {
    const db = this.drizzle.db;
    const [pending] = await db
      .select()
      .from(infoRequests)
      .where(and(eq(infoRequests.requesterId, userId), eq(infoRequests.status, RequestStatus.PENDING)))
      .limit(1);

    if (!pending) return null;

    const target = await this.getUserWithProfile(eq(users.id, pending.targetId));
    return {
      ...pending,
      target: target
        ? {
            publicId: target.publicId,
            profile: target.profile
              ? { firstName: this.maskFirstNameIfHidden(target.profile) }
              : null,
          }
        : null,
    };
  }

  private maskFirstNameIfHidden(p: any): string | null {
    const pf = p?.publicFields && typeof p.publicFields === 'object' ? p.publicFields : {};
    return pf['hideName'] ? null : p.firstName;
  }

  async respondToRequest(
    userId: string,
    requestId: string,
    dto: RespondRequestDto,
  ): Promise<{ success: boolean }> {
    const db = this.drizzle.db;
    const [request] = await db.select().from(infoRequests).where(eq(infoRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found');
    if (request.targetId !== userId) throw new ForbiddenException('You can only respond to requests sent to you');
    if (request.status !== RequestStatus.PENDING) throw new BadRequestException('This request has already been processed');

    if (new Date() > new Date(request.expiresAt)) {
      await db.update(infoRequests).set({ status: RequestStatus.EXPIRED as any }).where(eq(infoRequests.id, requestId));
      throw new BadRequestException('This request has expired');
    }

    const requester = await this.getUserWithProfile(eq(users.id, request.requesterId));
    const target = await this.getUserWithProfile(eq(users.id, request.targetId));
    if (!requester || !target) throw new NotFoundException('Request parties not found');

    if (dto.approved) {
      const oneTimeToken = this.encryptionService.generateToken(32);
      const allowedShares = dto.shareItems || ['phone', 'email'];

      await db
        .update(infoRequests)
        .set({
          status: RequestStatus.APPROVED as any,
          allowedShares,
          respondedAt: new Date().toISOString(),
          oneTimeToken,
        })
        .where(eq(infoRequests.id, requestId));

      const sharedInfo: { photo?: string; phone?: string; email?: string } = {};

      if (allowedShares.includes('photo')) {
        const [primary] = await db
          .select()
          .from(photos)
          .where(and(eq(photos.userId, target.id), eq(photos.isPrimary, true)))
          .limit(1);
        if (primary?.gcsDisplayPath) {
          sharedInfo.photo = await this.storageService.getOneTimeSignedUrl(primary.gcsDisplayPath);
        }
      }

      if (allowedShares.includes('phone')) sharedInfo.phone = target.phone || undefined;
      if (allowedShares.includes('email')) sharedInfo.email = target.email;

      try {
        await this.emailService.sendSharedInfoEmail(
          requester.email,
          requester.profile?.firstName || 'User',
          target.profile?.firstName || 'A user',
          sharedInfo,
        );
      } catch (error) {
        console.error('Failed to send shared info email:', error);
      }

      await this.auditService.logInfoRequest(
        userId,
        'REQUEST_APPROVED',
        request.requesterId,
        requestId,
        allowedShares,
      );
    } else {
      await db
        .update(infoRequests)
        .set({ status: RequestStatus.DENIED as any, respondedAt: new Date().toISOString() })
        .where(eq(infoRequests.id, requestId));

      try {
        await this.emailService.sendRequestDeniedEmail(requester.email, requester.profile?.firstName || 'User');
      } catch (error) {
        console.error('Failed to send denial email:', error);
      }

      await this.auditService.logInfoRequest(userId, 'REQUEST_DENIED', request.requesterId, requestId);
    }

    return { success: true };
  }

  async cancelRequest(userId: string, requestId: string): Promise<{ success: boolean }> {
    const db = this.drizzle.db;
    const [request] = await db.select().from(infoRequests).where(eq(infoRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== userId) {
      throw new ForbiddenException('You can only cancel requests you sent');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    // Audit before the delete so the row still exists for the log's context.
    await this.auditService.logInfoRequest(userId, 'REQUEST_CANCELLED', request.targetId, requestId);

    // Hard-delete rather than adding a CANCELLED status: the target never acted,
    // so there is nothing to preserve on the row, and it keeps the partial
    // unique index on (requester_id) WHERE status = 'PENDING' free immediately.
    await db.delete(infoRequests).where(eq(infoRequests.id, requestId));

    return { success: true };
  }

  async getIncomingRequests(userId: string) {
    const db = this.drizzle.db;
    const rows = await db
      .select()
      .from(infoRequests)
      .where(eq(infoRequests.targetId, userId))
      .orderBy(desc(infoRequests.createdAt));

    return Promise.all(
      rows.map(async (r) => {
        const requester = await this.getUserWithProfile(eq(users.id, r.requesterId));
        return {
          ...r,
          requester: requester
            ? {
                publicId: requester.publicId,
                profile: requester.profile
                  ? {
                      firstName: requester.profile.firstName,
                      gender: requester.profile.gender,
                      ethnicity: requester.profile.ethnicity,
                      city: requester.profile.city,
                      state: requester.profile.state,
                    }
                  : null,
              }
            : null,
        };
      }),
    );
  }

  async getOutgoingRequests(userId: string) {
    const db = this.drizzle.db;
    const rows = await db
      .select()
      .from(infoRequests)
      .where(eq(infoRequests.requesterId, userId))
      .orderBy(desc(infoRequests.createdAt));

    return Promise.all(
      rows.map(async (r) => {
        const target = await this.getUserWithProfile(eq(users.id, r.targetId));
        return {
          ...r,
          target: target
            ? {
                publicId: target.publicId,
                profile: target.profile
                  ? {
                      firstName: this.maskFirstNameIfHidden(target.profile),
                      gender: target.profile.gender,
                      ethnicity: target.profile.ethnicity,
                      city: target.profile.city,
                      state: target.profile.state,
                    }
                  : null,
              }
            : null,
        };
      }),
    );
  }

  async getSharedInfo(token: string) {
    const db = this.drizzle.db;
    const [request] = await db.select().from(infoRequests).where(eq(infoRequests.oneTimeToken, token)).limit(1);
    if (!request) throw new NotFoundException('Invalid or expired link');
    if (request.status !== RequestStatus.APPROVED) throw new BadRequestException('This request was not approved');
    if (request.tokenUsedAt) throw new BadRequestException('This link has already been used');

    await db
      .update(infoRequests)
      .set({ tokenUsedAt: new Date().toISOString() })
      .where(eq(infoRequests.id, request.id));

    const target = await this.getUserWithProfile(eq(users.id, request.targetId));
    if (!target) throw new NotFoundException('Target not found');

    const result: { photoUrl?: string; phone?: string; email?: string } = {};
    const allowedShares = request.allowedShares ?? [];

    if (allowedShares.includes('photo')) {
      const [primary] = await db
        .select()
        .from(photos)
        .where(and(eq(photos.userId, target.id), eq(photos.isPrimary, true)))
        .limit(1);
      if (primary?.gcsDisplayPath) {
        result.photoUrl = await this.storageService.getSignedUrl(primary.gcsDisplayPath, 60);
      }
    }

    if (allowedShares.includes('phone')) result.phone = target.phone || undefined;
    if (allowedShares.includes('email')) result.email = target.email;

    return result;
  }
}
