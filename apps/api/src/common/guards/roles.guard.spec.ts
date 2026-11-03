import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../types/role';

function contextFor(request: unknown): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles?: unknown[]): RolesGuard {
  const reflector = { getAllAndOverride: jest.fn(() => roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const ADMIN_ROUTE = [Role.ADMIN, Role.SUPER_ADMIN];
const verifiedSession = { twoFactorVerified: true };

describe('RolesGuard', () => {
  it('lets anyone through a route with no role requirement', () => {
    expect(guardRequiring(undefined).canActivate(contextFor({}))).toBe(true);
  });

  it('refuses a request with no user', () => {
    expect(() => guardRequiring(ADMIN_ROUTE).canActivate(contextFor({}))).toThrow(ForbiddenException);
  });

  it('refuses a member on an admin route', () => {
    const request = { user: { role: Role.USER, twoFactorEnabled: true }, session: verifiedSession };
    expect(() => guardRequiring(ADMIN_ROUTE).canActivate(contextFor(request))).toThrow('Insufficient permissions');
  });

  it.each([Role.ADMIN, Role.SUPER_ADMIN])('refuses %s who has not enrolled in 2FA', (role) => {
    const request = { user: { role, twoFactorEnabled: false }, session: verifiedSession };
    expect.assertions(2);
    try {
      guardRequiring(ADMIN_ROUTE).canActivate(contextFor(request));
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'ADMIN_2FA_NOT_ENROLLED' });
    }
  });

  // Phone-number verify, Google/Apple and email-link sign-in never pass the
  // second factor, so auth.ts leaves their sessions unstamped.
  it.each([
    [Role.ADMIN, { twoFactorVerified: false }],
    [Role.SUPER_ADMIN, { twoFactorVerified: false }],
    [Role.SUPER_ADMIN, { twoFactorVerified: null }],
    [Role.SUPER_ADMIN, undefined],
  ])('refuses enrolled %s on a session that skipped the second factor (%j)', (role, session) => {
    const request = { user: { role, twoFactorEnabled: true }, session };
    expect.assertions(2);
    try {
      guardRequiring(ADMIN_ROUTE).canActivate(contextFor(request));
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'ADMIN_2FA_SESSION_REQUIRED' });
    }
  });

  it.each([Role.ADMIN, Role.SUPER_ADMIN])('admits enrolled %s on a verified session', (role) => {
    const request = { user: { role, twoFactorEnabled: true }, session: verifiedSession };
    expect(guardRequiring(ADMIN_ROUTE).canActivate(contextFor(request))).toBe(true);
  });

  it('keeps a plain ADMIN off SUPER_ADMIN routes', () => {
    const request = { user: { role: Role.ADMIN, twoFactorEnabled: true }, session: verifiedSession };
    expect(() => guardRequiring([Role.SUPER_ADMIN]).canActivate(contextFor(request))).toThrow(ForbiddenException);
  });

  it('lets SUPER_ADMIN onto a route restricted to ADMIN', () => {
    const request = { user: { role: Role.SUPER_ADMIN, twoFactorEnabled: true }, session: verifiedSession };
    expect(guardRequiring([Role.ADMIN]).canActivate(contextFor(request))).toBe(true);
  });
});
