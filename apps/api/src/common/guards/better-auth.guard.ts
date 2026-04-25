import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DrizzleService } from '../../db/drizzle.service';
import { session } from '../../db/schema';

/**
 * BetterAuth session cookie guard, applied globally.
 * Validates the session token cookie against the session table; all routes
 * require a valid session unless the handler is marked with @Public().
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private drizzle: DrizzleService,
  ) {}

async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const rawCookie = request.cookies?.['better-auth.session_token']
    ?? request.cookies?.['__Secure-better-auth.session_token'];
    if (!rawCookie) throw new UnauthorizedException('Authentication required');
    const sessionToken = rawCookie.split('.')[0];

    let row: any;
    try {
      row = await this.drizzle.db.query.session.findFirst({
        where: eq(session.token, sessionToken),
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

    return true;
  }
}
