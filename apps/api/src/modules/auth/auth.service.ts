import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users } from '../../db/schema';
import { AuditService } from '../../services/audit.service';

/**
 * AuthService - thin utility layer. BetterAuth handles signup/login on the frontend.
 * Methods here are for backend consumers (/auth/me, legacy compat).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getMe(userId: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { profiles: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const profileRows = (user as any).profiles;
    const profile = Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null;

    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isPhoneVerified: user.isPhoneVerified,
      phone: user.phone,
      phoneGateExempt: user.phoneGateExempt,
      emailIsPlaceholder: user.emailIsPlaceholder,
      name: user.name,
      profile,
    };
  }

  async logLogin(userId: string, ipAddress?: string) {
    await this.drizzle.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, userId));
    await this.auditService.logLogin(userId, ipAddress);
  }
}
