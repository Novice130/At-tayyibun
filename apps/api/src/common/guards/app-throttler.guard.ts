import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getClientIp, ipRateLimitBucket } from '../http/client-ip';

/**
 * Counts signed-in members by user ID and everyone else by real client address.
 *
 * Runs after BetterAuthGuard (provider order in AppModule), which sets req.user
 * only from a verified session, on @Public routes too. A forged cookie therefore
 * gets the IP bucket, and if the order ever changes this degrades to per-IP
 * instead of failing. Requests the auth guard refuses never reach this guard.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    return `ip:${ipRateLimitBucket(getClientIp(req as never))}`;
  }
}
