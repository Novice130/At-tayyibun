import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { infoRequests, users, blocks } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { EncryptionService } from '../../services/encryption.service';
import { RequestStatus } from '../../common/types/role';
import { RespondRequestDto } from './dto';
import { hasCompleteProfile, isMutualMatch, toMatchSide } from '../profiles/marital-match';
import type { MaritalStatus } from '../profiles/marital-match';
import { CONTACT_LINK_TTL_DAYS, contactStateOf, isLiveRequest, isStalePending } from './request-state';

export type SharedContact = { name?: string; phone?: string; email?: string };

@Injectable()
export class RequestsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
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
    // Both sides must have a profile before a request is worth creating. The
    // notification email below is skipped when either is missing, so without
    // this guard the row was still written — consuming the requester's single
    // pending-request slot — while the target was never told about it.
    // The requester is checked first, before anything about the target (exists,
    // blocked, matches), so an incomplete requester always gets this same 400
    // and cannot use a 404 vs 400 difference to learn about the target.
    const requester = await this.getUserWithProfile(eq(users.id, requesterId));
    if (!requester?.profile || !hasCompleteProfile(requester.profile)) {
      throw new BadRequestException('Please complete your profile before sending a request.');
    }

    const target = await this.getUserWithProfile(eq(users.publicId, targetPublicId));
    if (!target || target.suspendedAt) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new BadRequestException('Cannot request your own information');
    if (!target.profile) {
      throw new BadRequestException('This member has not finished setting up their profile yet.');
    }

    // A block in either direction makes the connection void. Mirror the
    // browse/profiling rule: the requester should never have been able to
    // reach this user, and this guard makes the API tell them the same thing.
    const [blockRow] = await this.drizzle.db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, requesterId), eq(blocks.blockedId, target.id)),
          and(eq(blocks.blockerId, target.id), eq(blocks.blockedId, requesterId)),
        ),
      )
      .limit(1);
    if (blockRow) throw new NotFoundException('User not found');

    // Browse already hides incompatible pairs; re-check here so a publicId
    // found elsewhere cannot be used to reach someone who ruled the requester
    // out. A non-match gets the same answer as a block.
    if (!isMutualMatch(toMatchSide(requester.profile), toMatchSide(target.profile))) {
      throw new NotFoundException('User not found');
    }

    // Expiry is lazy, so close any lapsed request first: it would otherwise hold
    // the one pending slot and block the sender from sending again.
    const nowIso = new Date().toISOString();
    await this.drizzle.db
      .update(infoRequests)
      .set({ status: RequestStatus.EXPIRED as any })
      .where(
        and(
          eq(infoRequests.requesterId, requesterId),
          eq(infoRequests.status, RequestStatus.PENDING),
          lt(infoRequests.expiresAt, nowIso),
        ),
      );

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
      // Skip rather than bounce a notification off an unreachable .invalid
      // address; the request is still created and shows in-app.
      if (target.emailIsPlaceholder) throw new Error('placeholder email');
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
      .where(
        and(
          eq(infoRequests.requesterId, userId),
          eq(infoRequests.status, RequestStatus.PENDING),
          gt(infoRequests.expiresAt, new Date().toISOString()),
        ),
      )
      .limit(1);

    if (!pending) return null;

    const target = await this.getUserWithProfile(eq(users.id, pending.targetId));
    return {
      ...this.publicRow(pending),
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
      const allowedShares = dto.shareItems || ['phone', 'email'];
      const shareSource = dto.shareSource ?? 'SELF';

      // Refuse now rather than send a link that opens onto nothing.
      if (!this.hasContact(this.readContact(target, shareSource, allowedShares))) {
        throw new BadRequestException(
          shareSource === 'GUARDIAN'
            ? 'No guardian contact is saved on this profile.'
            : 'There is no verified contact to share on this account.',
        );
      }

      const contactExpiresAt = new Date();
      contactExpiresAt.setDate(contactExpiresAt.getDate() + CONTACT_LINK_TTL_DAYS);

      await db
        .update(infoRequests)
        .set({
          status: RequestStatus.APPROVED as any,
          allowedShares,
          shareSource,
          contactExpiresAt: contactExpiresAt.toISOString(),
          respondedAt: new Date().toISOString(),
        })
        .where(eq(infoRequests.id, requestId));

      try {
        // A phone-first requester has no real address. They use the Requests
        // screen, which also covers a failed send.
        if (requester.emailIsPlaceholder) throw new Error('placeholder email');
        await this.emailService.sendContactLinkEmail(
          requester.email,
          requester.profile?.firstName || 'User',
          this.maskFirstNameIfHidden(target.profile) || 'A member',
          requestId,
          CONTACT_LINK_TTL_DAYS,
        );
      } catch (error) {
        console.error('Failed to send contact link email:', error);
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

    // A declined, withdrawn or lapsed request is gone from the receiver's list.
    const items = await Promise.all(
      rows.filter((r) => isLiveRequest(r)).map(async (r) => {
        const requester = await this.getUserWithProfile(eq(users.id, r.requesterId));
        if (requester?.suspendedAt) return null;
        return {
          ...this.publicRow(r),
          requester: requester
            ? {
                publicId: requester.publicId,
                profile: requester.profile
                  ? {
                      firstName: this.maskFirstNameIfHidden(requester.profile),
                      gender: requester.profile.gender,
                      ethnicity: requester.profile.ethnicity,
                      city: requester.profile.city,
                      state: requester.profile.state,
                      // Incoming only: the receiver sees the requester's status.
                      // openTo* preferences are never returned.
                      maritalStatus: (requester.profile.maritalStatus ?? null) as MaritalStatus | null,
                      hasChildren: requester.profile.hasChildren ?? null,
                      childrenCount: requester.profile.childrenCount ?? null,
                    }
                  : null,
              }
            : null,
        };
      }),
    );
    return items.filter((item): item is NonNullable<typeof item> => item !== null);
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
          ...this.publicRow(r),
          status: isStalePending(r) ? RequestStatus.EXPIRED : r.status,
          contactState: contactStateOf(r),
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

  /**
   * Reveal the shared contact to the requester, once. POST behind a button so
   * an email scanner following the link cannot use up the view.
   */
  async revealContact(userId: string, requestId: string): Promise<SharedContact> {
    const db = this.drizzle.db;
    const [request] = await db.select().from(infoRequests).where(eq(infoRequests.id, requestId)).limit(1);
    // Same answer for "no such request" and "not yours": ids are not to be probed.
    if (!request || request.requesterId !== userId || request.status !== RequestStatus.APPROVED) {
      throw new NotFoundException('Request not found');
    }

    const state = contactStateOf(request);
    if (state === 'VIEWED') throw new GoneException('These contact details have already been viewed.');
    if (state === 'EXPIRED') throw new GoneException('This link has expired. You can send a new request.');
    if (state !== 'AVAILABLE') throw new GoneException('These contact details were sent to you by email.');

    // Read before claiming, so a view is not used up on something unavailable.
    const unavailable = 'These contact details are no longer available.';
    const target = await this.getUserWithProfile(eq(users.id, request.targetId));
    if (!target || target.suspendedAt) throw new GoneException(unavailable);

    const [blockRow] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userId), eq(blocks.blockedId, target.id)),
          and(eq(blocks.blockerId, target.id), eq(blocks.blockedId, userId)),
        ),
      )
      .limit(1);
    if (blockRow) throw new GoneException(unavailable);

    const contact = this.readContact(
      target,
      request.shareSource === 'GUARDIAN' ? 'GUARDIAN' : 'SELF',
      request.allowedShares ?? [],
    );
    if (!this.hasContact(contact)) throw new GoneException(unavailable);

    // The WHERE is the single-use guarantee: of two racing calls only one
    // updates a row, whatever the check above saw.
    const now = new Date().toISOString();
    const [claimed] = await db
      .update(infoRequests)
      .set({ tokenUsedAt: now })
      .where(
        and(
          eq(infoRequests.id, requestId),
          eq(infoRequests.requesterId, userId),
          eq(infoRequests.status, RequestStatus.APPROVED),
          isNull(infoRequests.tokenUsedAt),
          gt(infoRequests.contactExpiresAt, now),
        ),
      )
      .returning({ id: infoRequests.id });
    if (!claimed) throw new GoneException('These contact details have already been viewed.');

    await this.auditService.logInfoRequest(userId, 'CONTACT_VIEWED', target.id, requestId);
    return contact;
  }

  private hasContact(contact: SharedContact): boolean {
    return !!(contact.phone || contact.email);
  }

  /** The approver's chosen contact, limited to the items they allowed. */
  private readContact(
    target: { isPhoneVerified?: boolean; phone?: string | null; email: string; emailVerified?: boolean; emailIsPlaceholder?: boolean; profile?: any },
    source: 'GUARDIAN' | 'SELF',
    allowedShares: string[],
  ): SharedContact {
    const contact: SharedContact = {};

    if (source === 'GUARDIAN') {
      let biodata: Record<string, unknown> = {};
      if (target.profile?.biodataJsonEnc) {
        try {
          biodata = this.encryptionService.decryptJson(target.profile.biodataJsonEnc);
        } catch {
          /* treated as no guardian saved */
        }
      }
      const text = (key: string) => {
        const value = biodata[key];
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
      };
      // The signup form pre-fills the phone field with a bare country code.
      const phone = text('guardianPhone');
      if (allowedShares.includes('phone') && phone && /\d{7,}/.test(phone.replace(/\D/g, ''))) {
        contact.phone = phone;
      }
      if (allowedShares.includes('email')) contact.email = text('guardianEmail');
      if (this.hasContact(contact)) contact.name = text('guardianName');
      return contact;
    }

    // A phone-first account holds a +<e164>@phone.attayyibun.invalid placeholder
    // until it supplies a real address; handing that over as "their email" would
    // be worse than sharing nothing. Same for a phone nobody has verified, and for
    // an email address whose owner never confirmed it: sign-up does not check it,
    // so it could belong to someone else entirely.
    if (allowedShares.includes('phone') && target.isPhoneVerified && target.phone) contact.phone = target.phone;
    if (allowedShares.includes('email') && target.emailVerified && !target.emailIsPlaceholder) contact.email = target.email;
    return contact;
  }

  /** A request row as members may see it: the legacy token column stays server-side. */
  private publicRow<T extends { oneTimeToken?: unknown }>(row: T): Omit<T, 'oneTimeToken'> {
    const { oneTimeToken: _omit, ...rest } = row;
    return rest;
  }
}
