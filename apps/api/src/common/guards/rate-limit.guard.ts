import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export type RateLimitType = 'login' | 'signup' | 'browse' | 'infoRequest';

/**
 * Rate limiting guard using Redis
 * Prevents abuse of sensitive endpoints
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private limitType: RateLimitType = 'browse';

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  setLimitType(type: RateLimitType): RateLimitGuard {
    this.limitType = type;
    return this;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Get identifier: user ID if authenticated, IP otherwise
    const identifier = request.user?.id || request.ip || 'unknown';
    
    const rateLimits = this.configService.get(`security.rateLimits.${this.limitType}`);
    
    if (!rateLimits) {
      return true;
    }

    const { max, windowMs } = rateLimits;
    const windowSeconds = Math.ceil(windowMs / 1000);
    const key = `ratelimit:${this.limitType}:${identifier}`;

    const allowed = await this.redisService.checkRateLimit(key, max, windowSeconds);

    if (!allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
