import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../../db/drizzle.service';
import { users, account } from '../../db/schema';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly moderationService: ModerationService,
    private readonly configService: ConfigService,
  ) {}

  private async findWithProfile(where: any) {
    const user = await this.drizzle.db.query.users.findFirst({
      where,
      with: { profiles: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { profiles: profileRows, ...rest } = user as any;
    return {
      ...rest,
      profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
    };
  }

  findById(id: string) {
    return this.findWithProfile(eq(users.id, id));
  }

  findByPublicId(publicId: string) {
    return this.findWithProfile(eq(users.publicId, publicId));
  }

  async findByEmail(email: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row ?? null;
  }

  async findByPhone(phone: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return row ?? null;
  }

  /**
   * Permanently delete the caller's own account. Apple review explicitly tests
   * that "delete" is not a disguised deactivation — everything goes, now.
   */
  async deleteOwnAccount(userId: string) {
    await this.revokeAppleTokenIfPresent(userId);
    await this.moderationService.hardDeleteUser(userId, userId);
    return { ok: true };
  }

  /**
   * Apple requires apps using Sign in with Apple to revoke the user's token on
   * account deletion. Without the Apple secret in env this is skipped — the
   * deletion itself must not fail because of a missing configuration.
   */
  private async revokeAppleTokenIfPresent(userId: string) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('APPLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return;

    // Must filter on providerId: a user with both Google and Apple linked has
    // several account rows, and the Google row carries no Apple refresh token,
    // so taking the first row silently skipped the revoke.
    const [appleAccount] = await this.drizzle.db
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, 'apple')))
      .limit(1);

    const token = appleAccount?.refreshToken ?? appleAccount?.accessToken;
    if (!token) return;

    try {
      const response = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!response.ok) {
        console.error('Apple token revoke failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Apple token revoke request failed:', error);
    }
  }
}
