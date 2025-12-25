import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../services/audit.service';
import { Role, MembershipTier, Gender } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get analytics - user counts by gender and membership
   */
  async getAnalytics() {
    const [
      totalUsers,
      maleCount,
      femaleCount,
      freeCount,
      silverCount,
      goldCount,
      verifiedCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({ where: { gender: Gender.MALE } }),
      this.prisma.profile.count({ where: { gender: Gender.FEMALE } }),
      this.prisma.user.count({ where: { membershipTier: MembershipTier.FREE } }),
      this.prisma.user.count({ where: { membershipTier: MembershipTier.SILVER } }),
      this.prisma.user.count({ where: { membershipTier: MembershipTier.GOLD } }),
      this.prisma.user.count({ where: { isVerified: true } }),
    ]);

    return {
      totalUsers,
      byGender: {
        male: maleCount,
        female: femaleCount,
      },
      byMembership: {
        free: freeCount,
        silver: silverCount,
        gold: goldCount,
      },
      verifiedUsers: verifiedCount,
    };
  }

  /**
   * List all users with pagination
   */
  async listUsers(page = 1, limit = 20, search?: string) {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { publicId: { contains: search } },
            { profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          email: true,
          phone: true,
          role: true,
          membershipTier: true,
          isVerified: true,
          createdAt: true,
          rankBoost: true,
          profile: {
            select: {
              firstName: true,
              gender: true,
              ethnicity: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID or public ID
   */
  async getUser(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: identifier }, { publicId: identifier }],
      },
      include: {
        profile: true,
        photos: true,
        sentRequests: { take: 10, orderBy: { createdAt: 'desc' } },
        receivedRequests: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Set rank boost for a user (manual boost)
   */
  async setRankBoost(adminId: string, userId: string, boost: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        rankBoost: boost,
        rankBoostedAt: new Date(),
      },
    });

    await this.auditService.logAdminAction(adminId, 'SET_RANK_BOOST', 'user', userId, {
      boost,
    });

    return { success: true };
  }

  /**
   * Add admin user (SUPER_ADMIN only)
   */
  async addAdmin(superAdminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('User is already an admin');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    await this.auditService.logAdminAction(superAdminId, 'ADD_ADMIN', 'user', userId);

    return { success: true };
  }

  /**
   * Remove admin user (SUPER_ADMIN only)
   */
  async removeAdmin(superAdminId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot remove super admin');
    }

    if (admin.role !== Role.ADMIN) {
      throw new BadRequestException('User is not an admin');
    }

    await this.prisma.user.update({
      where: { id: adminId },
      data: { role: Role.USER },
    });

    await this.auditService.logAdminAction(superAdminId, 'REMOVE_ADMIN', 'user', adminId);

    return { success: true };
  }

  /**
   * Toggle membership system
   */
  async toggleMembership(adminId: string, enabled: boolean) {
    await this.prisma.systemConfig.upsert({
      where: { key: 'membership_enabled' },
      update: { value: enabled },
      create: { key: 'membership_enabled', value: enabled },
    });

    await this.auditService.logAdminAction(adminId, 'TOGGLE_MEMBERSHIP', 'system_config', undefined, {
      enabled,
    });

    return { success: true, enabled };
  }

  /**
   * Get system config
   */
  async getSystemConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    return Object.fromEntries(configs.map((c) => [c.key, c.value]));
  }
}
