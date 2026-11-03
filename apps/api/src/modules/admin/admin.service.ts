import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, notInArray, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { auditLogs, infoRequests, profiles, systemConfig, users } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { ModerationService } from '../moderation/moderation.service';

/** Members per bulk-nudge request; at 2 emails/s this is about 20 seconds. */
export const NUDGE_BATCH = 40;
/** Stop starting new sends after this long, so the request ends in time. */
export const NUDGE_TIME_BUDGET_MS = 45_000;

@Injectable()
export class AdminService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly moderationService: ModerationService,
  ) {}

  async getAnalytics() {
    try {
      const db = this.drizzle.db;
      const [
        [totalRow],
        [maleRow],
        [femaleRow],
        [freeRow],
        [silverRow],
        [goldRow],
        [verifiedRow],
      ] = await Promise.all([
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(profiles).where(eq(profiles.gender, 'MALE')),
        db.select({ value: count() }).from(profiles).where(eq(profiles.gender, 'FEMALE')),
        db.select({ value: count() }).from(users).where(eq(users.membershipTier, 'FREE')),
        db.select({ value: count() }).from(users).where(eq(users.membershipTier, 'SILVER')),
        db.select({ value: count() }).from(users).where(eq(users.membershipTier, 'GOLD')),
        db.select({ value: count() }).from(users).where(eq(users.isVerified, true)),
      ]);

    return {
      totalUsers: Number(totalRow.value),
      byGender: { male: Number(maleRow.value), female: Number(femaleRow.value) },
      byMembership: {
        free: Number(freeRow.value),
        silver: Number(silverRow.value),
        gold: Number(goldRow.value),
      },
      verifiedUsers: Number(verifiedRow.value),
    };
    } catch (error) {
      console.error('[AdminService] getAnalytics FAILED:', error);
      throw error;
    }
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const db = this.drizzle.db;
    const pattern = search ? `%${search}%` : undefined;

    const whereClause = pattern
      ? or(
          ilike(users.email, pattern),
          ilike(users.publicId, pattern),
          sql`EXISTS (SELECT 1 FROM ${profiles} WHERE ${profiles.userId} = ${users.id} AND ${profiles.firstName} ILIKE ${pattern})`,
        )
      : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        columns: {
          id: true,
          publicId: true,
          email: true,
          phone: true,
          role: true,
          membershipTier: true,
          isVerified: true,
          suspendedAt: true,
          isPhoneVerified: true,
          emailVerified: true,
          createdAt: true,
          rankBoost: true,
        },
        with: {
          profiles: {
            columns: { firstName: true, gender: true, ethnicity: true },
          },
        },
        orderBy: [desc(users.createdAt)],
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ value: count() }).from(users).where(whereClause ?? sql`TRUE`),
    ]);

    // The introspected relation exposes `profiles` (one-to-one on user_id). Collapse to single `profile`.
    const data = rows.map(({ profiles: profileRows, ...u }: any) => ({
      ...u,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    }));

    return {
      data,
      meta: {
        total: Number(totalRow.value),
        page,
        limit,
        pages: Math.ceil(Number(totalRow.value) / limit),
      },
    };
  }

  async getUser(identifier: string) {
    const db = this.drizzle.db;
    // Explicit allowlist: exactly what the admin inspector reads. Never return
    // the whole row — users carries the legacy password_hash and token columns,
    // and profiles carries encrypted fields (lastNameEnc, bioEnc, biodataJsonEnc).
    const user = await db.query.users.findFirst({
      where: or(eq(users.id, identifier), eq(users.publicId, identifier)),
      columns: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        emailIsPlaceholder: true,
        phone: true,
        isPhoneVerified: true,
        role: true,
        membershipTier: true,
        isVerified: true,
        suspendedAt: true,
        rankBoost: true,
        createdAt: true,
      },
      with: {
        profiles: { columns: { firstName: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Normalize the introspected relation name to the shape the frontend consumes.
    const { profiles: profileRows, ...rest } = user as any;
    return {
      ...rest,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    };
  }

  async updateUser(
    adminId: string,
    userId: string,
    dto: { membershipTier?: 'FREE' | 'SILVER' | 'GOLD'; isVerified?: boolean; name?: string },
  ) {
    const db = this.drizzle.db;
    const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot edit SUPER_ADMIN via this endpoint');
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.membershipTier !== undefined) patch.membershipTier = dto.membershipTier;
    if (dto.isVerified !== undefined) patch.isVerified = dto.isVerified;
    if (dto.name !== undefined) patch.name = dto.name;

    if (Object.keys(patch).length === 1) {
      throw new BadRequestException('No updatable fields provided');
    }

    await db.update(users).set(patch).where(eq(users.id, userId));
    await this.auditService.logAdminAction(adminId, 'UPDATE_USER', 'user', userId, dto);
    return { success: true };
  }

  /**
   * Accounts that signed up with an email but never verified a phone number —
   * the incomplete-signup rows visible in the admin panel with no profile.
   * Placeholder (+e164@phone.attayyibun.invalid) addresses are excluded: mail
   * to them can only hard-bounce and hurt the sending domain's reputation.
   * Phone-first accounts and anyone who already has a profile are excluded too.
   */
  private incompleteSignupWhere() {
    return and(
      eq(users.emailIsPlaceholder, false),
      eq(users.isPhoneVerified, false),
      eq(users.phoneGateExempt, false),
      isNull(profiles.userId),
      notInArray(users.role, ['ADMIN', 'SUPER_ADMIN']),
    );
  }

  async countIncompleteSignups() {
    const db = this.drizzle.db;
    const [row] = await db
      .select({ value: count() })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(this.incompleteSignupWhere());
    return { count: Number(row.value) };
  }

  async nudgeUser(adminId: string, userId: string) {
    const db = this.drizzle.db;
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailIsPlaceholder: users.emailIsPlaceholder,
        isPhoneVerified: users.isPhoneVerified,
        profileId: profiles.userId,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId));

    if (!row) throw new NotFoundException('User not found');
    if (row.emailIsPlaceholder) throw new BadRequestException('Phone-first account has no real email to nudge');
    if (row.isPhoneVerified) throw new BadRequestException('User already verified their phone');
    if (row.profileId) throw new BadRequestException('User already has a profile');

    await this.emailService.sendVerifyPhoneNudgeEmail(row.email, row.name ? row.name.split(' ')[0] : null);
    await this.auditService.logAdminAction(adminId, 'NUDGE_VERIFY_PHONE', 'user', userId, { email: row.email });
    return { success: true, email: row.email };
  }

  /**
   * Emails incomplete signups in batches. Sends are paced to Resend's rate
   * limit, so one HTTP request handles at most NUDGE_BATCH members and stops
   * starting new sends after NUDGE_TIME_BUDGET_MS, well inside the
   * Cloudflare/Caddy timeout. Anyone nudged in the last 24 hours is skipped,
   * so a retry or a second click moves on to the next members instead of
   * emailing the same people again. `more` tells the admin to run it again.
   */
  async nudgeAllIncomplete(adminId: string) {
    const db = this.drizzle.db;
    const recentlyNudged = sql`exists (
      select 1 from ${auditLogs}
      where ${auditLogs.action} = 'ADMIN_NUDGE_VERIFY_PHONE'
        and ${auditLogs.resourceId} = ${users.id}
        and ${auditLogs.createdAt} > now() - interval '24 hours')`;
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(and(this.incompleteSignupWhere(), sql`not ${recentlyNudged}`))
      .orderBy(users.createdAt)
      .limit(NUDGE_BATCH + 1);
    let more = rows.length > NUDGE_BATCH;
    const targets = rows.slice(0, NUDGE_BATCH);

    const stopAt = Date.now() + NUDGE_TIME_BUDGET_MS;
    let sent = 0;
    let attempted = 0;
    const failed: { email: string; error: string }[] = [];
    for (const t of targets) {
      if (Date.now() > stopAt) {
        more = true;
        break;
      }
      attempted += 1;
      try {
        await this.emailService.sendVerifyPhoneNudgeEmail(t.email, t.name ? t.name.split(' ')[0] : null);
        await this.auditService.logAdminAction(adminId, 'NUDGE_VERIFY_PHONE', 'user', t.id, { email: t.email });
        sent += 1;
      } catch (e: any) {
        failed.push({ email: t.email, error: e?.message || 'send failed' });
      }
    }
    return { total: attempted, sent, failed, more };
  }

  async deleteUser(adminId: string, userId: string) {
    if (adminId === userId) throw new BadRequestException('Cannot delete your own account');
    const db = this.drizzle.db;
    const [target] = await db.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq(users.id, userId));
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot delete a SUPER_ADMIN');

    await this.moderationService.hardDeleteUser(userId, adminId);

    await this.auditService.logAdminAction(adminId, 'DELETE_USER', 'user', userId, { email: target.email });
    return { success: true };
  }

  async unsuspendUser(adminId: string, userId: string) {
    const db = this.drizzle.db;
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!target) throw new NotFoundException('User not found');

    await db.update(users).set({ suspendedAt: null }).where(eq(users.id, userId));
    await this.auditService.logAdminAction(adminId, 'UNSUSPEND_USER', 'user', userId, {});
    return { success: true };
  }

  async setRankBoost(adminId: string, userId: string, boost: number) {
    const db = this.drizzle.db;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');

    await db
      .update(users)
      .set({ rankBoost: boost, rankBoostedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    await this.auditService.logAdminAction(adminId, 'SET_RANK_BOOST', 'user', userId, { boost });

    return { success: true };
  }

  async addAdmin(superAdminId: string, userId: string) {
    const db = this.drizzle.db;
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      throw new BadRequestException('User is already an admin');
    }

    await db.update(users).set({ role: 'ADMIN', updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
    await this.auditService.logAdminAction(superAdminId, 'ADD_ADMIN', 'user', userId);
    return { success: true };
  }

  async removeAdmin(superAdminId: string, adminId: string) {
    const db = this.drizzle.db;
    const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.id, adminId));
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot remove super admin');
    if (admin.role !== 'ADMIN') throw new BadRequestException('User is not an admin');

    await db.update(users).set({ role: 'USER', updatedAt: new Date().toISOString() }).where(eq(users.id, adminId));
    await this.auditService.logAdminAction(superAdminId, 'REMOVE_ADMIN', 'user', adminId);
    return { success: true };
  }

  async toggleMembership(adminId: string, enabled: boolean) {
    const db = this.drizzle.db;
    await db
      .insert(systemConfig)
      .values({ key: 'membership_enabled', value: enabled, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: enabled, updatedAt: new Date().toISOString() },
      });

    await this.auditService.logAdminAction(adminId, 'TOGGLE_MEMBERSHIP', 'system_config', undefined, { enabled });
    return { success: true, enabled };
  }

  async getSystemConfig() {
    const db = this.drizzle.db;
    const rows = await db.select().from(systemConfig);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
