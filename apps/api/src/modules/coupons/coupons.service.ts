import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async getActiveCoupons() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gte: now },
        OR: [{ usageLimit: null }, { usedCount: { lt: this.prisma.coupon.fields.usageLimit } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordUsage(couponId: string) {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
