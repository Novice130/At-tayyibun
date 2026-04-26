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

    // Better-auth only issues a session_token cookie after OTP verify.
    // If we have a session here at all, 2FA was satisfied — no need to
    // re-check session.twoFactorVerified (better-auth never writes it).
    if (user.role === Role.SUPER_ADMIN) return true;

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
