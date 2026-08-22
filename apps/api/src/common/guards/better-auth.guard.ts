import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_UNVERIFIED_PHONE_KEY } from '../decorators/allow-unverified-phone.decorator';
import { DrizzleService } from '../../db/drizzle.service';
import { session } from '../../db/schema';

const SESSION_COOKIES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

/**
 * BetterAuth session cookie guard, applied globally.
 *
 * Verifies the better-auth cookie signature (HMAC-SHA256 over the token,
 * signed with BETTER_AUTH_SECRET — the same scheme better-call uses) before
 * touching the database, and compares the token against the session table in
 * constant time. All routes require a valid session unless the handler is
 * marked with @Public().
 *
 * Also enforces the phone gate: a signed-in user with no verified phone number
 * is refused unless the handler is marked @AllowUnverifiedPhone(). This is the
 * authoritative check — the web and Flutter redirects are convenience, and
 * neither is reachable by someone calling the API directly.
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  private readonly authSecret: string | undefined;

  constructor(
    private reflector: Reflector,
    private drizzle: DrizzleService,
    config: ConfigService,
  ) {
    this.authSecret = config.get<string>('BETTER_AUTH_SECRET') || undefined;
  }

  private extractToken(rawCookie: string): { token: string; signature: string } | null {
    const dot = rawCookie.lastIndexOf('.');
    if (dot < 1) return null;
    const token = rawCookie.slice(0, dot);
    const signature = rawCookie.slice(dot + 1);
    if (!token || !signature) return null;
    return { token, signature };
  }

  /**
   * Reproduces better-call's getSignedCookie verification: the signature is
   * the standard-base64 HMAC-SHA256 of the raw token string.
   */
  private verifySignature(token: string, signature: string): boolean {
    if (!this.authSecret) return false;
    try {
      const expected = createHmac('sha256', this.authSecret).update(token).digest('base64');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const rawCookie = SESSION_COOKIES
      .map((name) => request.cookies?.[name])
      .find((value) => typeof value === 'string' && value.length > 0);
    if (!rawCookie) throw new UnauthorizedException('Authentication required');

    const parsed = this.extractToken(rawCookie);
    if (!parsed) throw new UnauthorizedException('Invalid session');

    // Fail closed: signature verification is mandatory. If the secret is not
    // configured in this service's environment, auth is refused with a clear
    // operator-facing reason instead of silently downgrading to DB lookups.
    if (!this.authSecret) {
      console.error(
        '[BetterAuthGuard] BETTER_AUTH_SECRET is not set; refusing to validate sessions without signature verification. Add BETTER_AUTH_SECRET to the API service environment.',
      );
      throw new UnauthorizedException('Authentication service misconfigured');
    }
    if (!this.verifySignature(parsed.token, parsed.signature)) {
      throw new UnauthorizedException('Invalid session');
    }

    let row: any;
    try {
      row = await this.drizzle.db.query.session.findFirst({
        where: eq(session.token, parsed.token),
        with: {
          user: { with: { profiles: true } },
        },
      });
    } catch (dbError) {
      console.error('[BetterAuthGuard] DB session lookup failed:', dbError);
      throw new UnauthorizedException('Authentication service temporarily unavailable');
    }

    if (!row) throw new UnauthorizedException('Invalid session');
    if (new Date(row.expiresAt) < new Date()) throw new UnauthorizedException('Session expired');

    request.session = row;
    const user = (row as any).user;
    if (user) {
      const { profiles: profileRows, ...rest } = user;
      request.user = {
        ...rest,
        profile: Array.isArray(profileRows) ? profileRows[0] ?? null : profileRows ?? null,
      };
    }

    // Phone gate. phoneGateExempt covers accounts that predate phone
    // verification, so nobody who already signed up is locked out.
    const allowUnverifiedPhone = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_PHONE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowUnverifiedPhone && user && !user.isPhoneVerified && !user.phoneGateExempt) {
      throw new ForbiddenException({
        message: 'Phone verification required',
        code: 'PHONE_VERIFICATION_REQUIRED',
      });
    }

    return true;
  }
}
