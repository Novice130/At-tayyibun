import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { profiles, systemConfig, users } from '../../db/schema';
import { AuditService } from '../../services/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
  ) {}

  async getAnalytics() {
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
    const user = await db.query.users.findFirst({
      where: or(eq(users.id, identifier), eq(users.publicId, identifier)),
      with: {
        profiles: true,
        photos: true,
        infoRequests_requesterId: { limit: 10, orderBy: (t, { desc }) => [desc(t.createdAt)] },
        infoRequests_targetId: { limit: 10, orderBy: (t, { desc }) => [desc(t.createdAt)] },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Normalize introspected relation names to the shape the frontend consumed before.
    const { profiles: profileRows, infoRequests_requesterId, infoRequests_targetId, ...rest } = user as any;
    return {
      ...rest,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
      sentRequests: infoRequests_requesterId ?? [],
      receivedRequests: infoRequests_targetId ?? [],
    };
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
