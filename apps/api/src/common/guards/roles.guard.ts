import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/role';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user) throw new ForbiddenException('Access denied');

    if (user.role !== Role.SUPER_ADMIN && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      this.assertSecondFactor(user, request.session);
    }
    return true;
  }

  /**
   * The server-side half of admin 2FA. Better Auth runs its challenge only on
   * /sign-in/email, /sign-in/username and /sign-in/phone-number, so a session
   * from /phone-number/verify, a Google or Apple callback, or an email link
   * exists without a second factor having been asked for. auth.ts stamps
   * session.twoFactorVerified on the sessions that did pass one.
   *
   * Enrolment cannot be locked out by this: the /auth/two-factor/* endpoints are
   * served by Better Auth in the web app and never reach this guard.
   */
  private assertSecondFactor(user: { twoFactorEnabled?: boolean }, session?: { twoFactorVerified?: boolean | null }) {
    if (user.twoFactorEnabled !== true) {
      throw new ForbiddenException({
        message: 'Set up two-factor authentication to use the admin panel.',
        code: 'ADMIN_2FA_NOT_ENROLLED',
      });
    }
    if (session?.twoFactorVerified !== true) {
      throw new ForbiddenException({
        message: 'Sign in with your email, password and verification code to use the admin panel.',
        code: 'ADMIN_2FA_SESSION_REQUIRED',
      });
    }
  }
}
