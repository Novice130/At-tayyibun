// Gold Weekly Boost Job
// Runs every Sunday at midnight via Cloud Scheduler
// Boosts all Gold members' rank by configured amount
// Cloud Scheduler cron: 0 0 * * 0
// Target: POST /api/jobs/gold-boost

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class GoldBoostJob {
  private readonly logger = new Logger(GoldBoostJob.name);
  private readonly BOOST_AMOUNT = 10; // Configurable boost amount

  constructor(private prisma: PrismaService) {}

  async execute(): Promise<{ boostedUsers: number }> {
    this.logger.log('Starting gold weekly boost job...');

    const now = new Date();

    // Find all active Gold members who haven't been boosted this week
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const goldMembers = await this.prisma.user.findMany({
      where: {
        membershipTier: 'GOLD',
        isActive: true,
        OR: [
          { lastBoostAt: null },
          { lastBoostAt: { lt: oneWeekAgo } },
        ],
      },
      select: { id: true },
    });

    if (goldMembers.length === 0) {
      this.logger.log('No Gold members eligible for boost');
      return { boostedUsers: 0 };
    }

    // Boost all eligible Gold members
    await this.prisma.user.updateMany({
      where: {
        id: { in: goldMembers.map(m => m.id) },
      },
      data: {
        rankBoost: { increment: this.BOOST_AMOUNT },
        lastBoostAt: now,
      },
    });

    this.logger.log(`Boosted ${goldMembers.length} Gold members`);

    return { boostedUsers: goldMembers.length };
  }
}
