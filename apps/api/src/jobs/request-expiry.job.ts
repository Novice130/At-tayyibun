// Request Expiry Job
// Runs every 15 minutes via Cloud Scheduler
// Marks expired pending requests as EXPIRED
// Cloud Scheduler cron: 0/15 * * * *
// Target: POST /api/jobs/request-expiry

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class RequestExpiryJob {
  private readonly logger = new Logger(RequestExpiryJob.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async execute(): Promise<{ processed: number }> {
    this.logger.log('Starting request expiry job...');

    const now = new Date();

    // Find all expired pending requests
    const expiredRequests = await this.prisma.infoRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      select: { id: true, requesterId: true },
    });

    if (expiredRequests.length === 0) {
      this.logger.log('No expired requests found');
      return { processed: 0 };
    }

    // Update all expired requests to EXPIRED status
    await this.prisma.infoRequest.updateMany({
      where: {
        id: { in: expiredRequests.map(r => r.id) },
      },
      data: {
        status: 'EXPIRED',
        allowedShares: 'NONE',
      },
    });

    // Clean up active request tracking
    await this.prisma.activeRequest.deleteMany({
      where: {
        requestId: { in: expiredRequests.map(r => r.id) },
      },
    });

    // Release Redis locks for each requester
    for (const request of expiredRequests) {
      await this.redis.releaseLock(`active_request:${request.requesterId}`);
    }

    this.logger.log(`Processed ${expiredRequests.length} expired requests`);

    return { processed: expiredRequests.length };
  }
}
