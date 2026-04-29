import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, ne } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users } from '../../db/schema';
import { AuditService } from '../../services/audit.service';
import { TwilioService } from '../../services/twilio.service';

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
    private readonly twilio: TwilioService,
  ) {}

  async sendPhoneOtp(userId: string, phone: string): Promise<void> {
    const db = this.drizzle.db;
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, phone), ne(users.id, userId)))
      .limit(1);
    if (taken) throw new BadRequestException('Phone number already in use');

    await db.update(users).set({ phone, isPhoneVerified: false }).where(eq(users.id, userId));
    await this.twilio.sendVerification(phone);
  }

  async verifyPhoneOtp(userId: string, code: string): Promise<{ verified: true }> {
    const db = this.drizzle.db;
    const [user] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.phone) throw new BadRequestException('No phone on file. Send an OTP first.');
    const ok = await this.twilio.checkVerification(user.phone, code);
    if (!ok) throw new BadRequestException('Invalid or expired code');
    await db.update(users).set({ isPhoneVerified: true }).where(eq(users.id, userId));
    return { verified: true };
  }

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
