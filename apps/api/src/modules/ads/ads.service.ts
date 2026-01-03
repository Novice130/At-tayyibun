import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MembershipTier } from '@prisma/client';

@Injectable()
export class AdsService {
  constructor(private prisma: PrismaService) {}

  async getAdsForUser(tier: MembershipTier) {
    const now = new Date();
    const tierFilter = tier === 'FREE' 
      ? { showToFree: true }
      : tier === 'SILVER'
      ? { showToSilver: true }
      : { showToGold: true };

    return this.prisma.ad.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        ...tierFilter,
      },
      orderBy: { priority: 'desc' },
      take: 10,
    });
  }

  async recordImpression(adId: string) {
    await this.prisma.ad.update({
      where: { id: adId },
      data: { impressions: { increment: 1 } },
    });
  }

  async recordClick(adId: string) {
    await this.prisma.ad.update({
      where: { id: adId },
      data: { clicks: { increment: 1 } },
    });
  }

  async getAdFrequency(tier: MembershipTier): Promise<number> {
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
    if (!config) return tier === 'FREE' ? 5 : tier === 'SILVER' ? 15 : 0;
    return tier === 'FREE' ? config.adFrequencyFree : tier === 'SILVER' ? config.adFrequencySilver : config.adFrequencyGold;
  }
}
