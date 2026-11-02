import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'crypto';
import { BetterAuthGuard } from './better-auth.guard';
import { DrizzleService } from '../../db/drizzle.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_SUSPENDED_KEY } from '../decorators/allow-suspended.decorator';

const SECRET = 'test-secret';
const TOKEN = 'session-token';
const COOKIE = `${TOKEN}.${createHmac('sha256', SECRET).update(TOKEN).digest('base64')}`;

function run(user: Record<string, unknown>, metadata: Record<string, boolean> = {}) {
  const reflector = { getAllAndOverride: (key: string) => metadata[key] ?? false } as unknown as Reflector;
  const db = {
    query: {
      session: {
        findFirst: async () => ({
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          user: { isPhoneVerified: true, profiles: [], ...user },
        }),
      },
    },
  };
  const guard = new BetterAuthGuard(
    reflector,
    { db } as unknown as DrizzleService,
    new ConfigService({ BETTER_AUTH_SECRET: SECRET }),
  );
  const request: any = { cookies: { 'better-auth.session_token': COOKIE } };
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { result: guard.canActivate(context), request };
}

describe('BetterAuthGuard suspension', () => {
  const suspended = { suspendedAt: '2026-11-01T00:00:00.000Z' };

  it('admits a member who is not suspended', async () => {
    await expect(run({ suspendedAt: null }).result).resolves.toBe(true);
  });

  it('refuses a suspended member with a code the clients recognise', async () => {
    const err = await run(suspended).result.catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('lets a suspended member reach a route marked for them, such as self-delete', async () => {
    await expect(run(suspended, { [ALLOW_SUSPENDED_KEY]: true }).result).resolves.toBe(true);
  });

  it('treats a suspended member as anonymous on public routes', async () => {
    const { result, request } = run(suspended, { [IS_PUBLIC_KEY]: true });
    await expect(result).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
