import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Set a value with optional expiration
   */
  async set(key: string, value: string, expiresInSeconds?: number): Promise<void> {
    if (expiresInSeconds) {
      await this.client.setex(key, expiresInSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Acquire a lock (for distributed locking)
   */
  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release a lock
   */
  async releaseLock(lockKey: string): Promise<void> {
    await this.client.del(lockKey);
  }

  /**
   * Rate limiting: check if rate limit exceeded
   * Returns true if request is allowed, false if rate limited
   */
  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }

    return current <= maxRequests;
  }
}
