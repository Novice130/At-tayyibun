import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole, MembershipTier, Gender } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [totalUsers, maleCount, femaleCount, paidUsers, tierCounts] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.profile.count({ where: { gender: 'MALE' } }),
      this.prisma.profile.count({ where: { gender: 'FEMALE' } }),
      this.prisma.user.count({ where: { membershipTier: { not: 'FREE' } } }),
      this.prisma.user.groupBy({
        by: ['membershipTier'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    return {
      totalUsers,
      byGender: { male: maleCount, female: femaleCount },
      paidUsers,
      byTier: tierCounts.reduce((acc, t) => ({ ...acc, [t.membershipTier]: t._count }), {}),
    };
  }

  async listUsers(page = 1, limit = 50, filters?: { tier?: MembershipTier; gender?: Gender }) {
    const where: any = { isActive: true };
    if (filters?.tier) where.membershipTier = filters.tier;
    if (filters?.gender) where.profile = { gender: filters.gender };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: { select: { firstName: true, gender: true, city: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async getUserByIdOrPublicId(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] },
      include: { profile: true, photos: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async boostUser(userId: string, amount: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { rankBoost: { increment: amount } },
    });
  }

  async addAdmin(userId: string, addedByAdminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: addedByAdminId } });
    if (admin?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admins can add new admins');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN', addedByAdminId },
    });
  }

  async removeAdmin(userId: string, removedByAdminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: removedByAdminId } });
    if (admin?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admins can remove admins');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER', addedByAdminId: null },
    });
  }

  async getSiteConfig() {
    return this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
  }

  async updateSiteConfig(data: {
    membershipEnabled?: boolean;
    silverPrice?: number;
    goldPrice?: number;
    adFrequencyFree?: number;
    adFrequencySilver?: number;
    adFrequencyGold?: number;
  }) {
    return this.prisma.siteConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
  }

  // Ads CRUD
  async createAd(data: any) {
    return this.prisma.ad.create({ data });
  }

  async updateAd(id: string, data: any) {
    return this.prisma.ad.update({ where: { id }, data });
  }

  async deleteAd(id: string) {
    return this.prisma.ad.delete({ where: { id } });
  }

  async listAds() {
    return this.prisma.ad.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Coupons CRUD
  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }

  async updateCoupon(id: string, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }

  async deleteCoupon(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  async listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
