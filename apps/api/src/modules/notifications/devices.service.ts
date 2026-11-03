import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../../db/drizzle.service';
import { deviceTokens, users } from '../../db/schema';
import type { DevicePlatform } from './dto';

/** Devices kept per member. Registering one more drops the least recently seen. */
export const MAX_DEVICE_TOKENS_PER_USER = 10;

@Injectable()
export class DevicesService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Upsert by token. A token belongs to one app install, so if another member
   * signed in on this device before, the token moves to the caller.
   */
  async register(userId: string, token: string, platform: DevicePlatform): Promise<{ success: boolean }> {
    const now = new Date().toISOString();
    await this.drizzle.db.transaction(async (tx) => {
      await tx
        .insert(deviceTokens)
        .values({ id: randomUUID(), userId, token, platform, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: deviceTokens.token,
          set: { userId, platform, updatedAt: now },
        });

      const overflow = await tx
        .select({ id: deviceTokens.id })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId))
        .orderBy(desc(deviceTokens.updatedAt), desc(deviceTokens.createdAt))
        .offset(MAX_DEVICE_TOKENS_PER_USER);
      if (overflow.length > 0) {
        await tx.delete(deviceTokens).where(
          inArray(
            deviceTokens.id,
            overflow.map((r) => r.id),
          ),
        );
      }
    });
    return { success: true };
  }

  /** Forget the caller's own token (sign-out). Unknown or foreign tokens are a no-op. */
  async unregister(userId: string, token: string): Promise<{ success: boolean }> {
    await this.drizzle.db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
    return { success: true };
  }

  /** Tokens to push to. A suspended member gets nothing. */
  async tokensFor(userId: string): Promise<string[]> {
    const rows = await this.drizzle.db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .innerJoin(users, eq(users.id, deviceTokens.userId))
      .where(and(eq(deviceTokens.userId, userId), isNull(users.suspendedAt)));
    return rows.map((r) => r.token);
  }

  /** Drop tokens FCM reported as no longer valid. */
  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.drizzle.db.delete(deviceTokens).where(inArray(deviceTokens.token, tokens));
  }
}
