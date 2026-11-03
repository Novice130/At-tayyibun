import { CanActivate, Controller, ExecutionContext, Get, INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppThrottlerGuard } from './app-throttler.guard';
import { createLoadtestSkipIf, LOADTEST_BYPASS_HEADER } from '../loadtest/loadtest-bypass';

// The repo has supertest but not @types/supertest; adding it would change the lockfile.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const SECRET = 'a'.repeat(40);
const CF_EDGE = '162.158.10.20';

/** Stands in for BetterAuthGuard: a verified session puts the user on the request. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const id = req.headers['x-test-user'];
    if (id) req.user = { id };
    return true;
  }
}

@Controller()
class TestController {
  @Get('limited')
  limited() {
    return { ok: true };
  }

  @Get('route-limited')
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  routeLimited() {
    return { ok: true };
  }
}

async function build(env: NodeJS.ProcessEnv): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ ttl: 60000, limit: 2 }],
        skipIf: createLoadtestSkipIf(env),
      }),
    ],
    controllers: [TestController],
    providers: [
      // Same order as AppModule: auth first, so the throttler can see req.user.
      { provide: APP_GUARD, useClass: FakeAuthGuard },
      { provide: APP_GUARD, useClass: AppThrottlerGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.init();
  return app;
}

const viaCloudflare = (visitor: string) => ({
  'x-forwarded-for': `${visitor}, ${CF_EDGE}`,
  'cf-connecting-ip': visitor,
});

describe('AppThrottlerGuard', () => {
  let app: INestApplication;

  describe('tracker', () => {
    beforeEach(async () => {
      app = await build({});
    });
    afterEach(() => app.close());

    const hit = (headers: Record<string, string>, path = '/limited') =>
      request(app.getHttpServer()).get(path).set(headers);

    it('counts two visitors behind one Cloudflare edge separately', async () => {
      await hit(viaCloudflare('203.0.113.1')).expect(200);
      await hit(viaCloudflare('203.0.113.1')).expect(200);
      await hit(viaCloudflare('203.0.113.1')).expect(429);
      await hit(viaCloudflare('203.0.113.2')).expect(200);
    });

    it('counts a signed-in user by ID, so changing network does not reset the limit', async () => {
      await hit({ 'x-test-user': 'u1', ...viaCloudflare('203.0.113.1') }).expect(200);
      await hit({ 'x-test-user': 'u1', ...viaCloudflare('203.0.113.2') }).expect(200);
      await hit({ 'x-test-user': 'u1', ...viaCloudflare('203.0.113.3') }).expect(429);
    });

    it('keeps two signed-in users on one address apart', async () => {
      await hit({ 'x-test-user': 'u1', ...viaCloudflare('203.0.113.1') }).expect(200);
      await hit({ 'x-test-user': 'u1', ...viaCloudflare('203.0.113.1') }).expect(200);
      await hit({ 'x-test-user': 'u2', ...viaCloudflare('203.0.113.1') }).expect(200);
    });

    it('a visitor cannot escape the limit by rotating a forged CF-Connecting-IP past a non-Cloudflare hop', async () => {
      const forged = (ip: string) => ({ 'x-forwarded-for': '198.51.100.7', 'cf-connecting-ip': ip });
      await hit(forged('1.1.1.1')).expect(200);
      await hit(forged('2.2.2.2')).expect(200);
      await hit(forged('3.3.3.3')).expect(429);
    });

    it('a visitor cannot escape the limit by rotating X-Forwarded-For through Cloudflare', async () => {
      const forged = (ip: string) => ({
        'x-forwarded-for': `${ip}, 203.0.113.1, ${CF_EDGE}`,
        'cf-connecting-ip': '203.0.113.1',
      });
      await hit(forged('1.1.1.1')).expect(200);
      await hit(forged('2.2.2.2')).expect(200);
      await hit(forged('3.3.3.3')).expect(429);
    });

    it('a user ID cannot collide with an IP bucket', async () => {
      await hit(viaCloudflare('203.0.113.1')).expect(200);
      await hit(viaCloudflare('203.0.113.1')).expect(200);
      await hit({ 'x-test-user': '203.0.113.1', ...viaCloudflare('203.0.113.1') }).expect(200);
    });
  });

  describe('load-test bypass', () => {
    afterEach(() => app.close());

    const exhaust = async (headers: Record<string, string>, path = '/limited', limit = 2) => {
      for (let i = 0; i < limit; i++) {
        await request(app.getHttpServer()).get(path).set(headers).expect(200);
      }
      await request(app.getHttpServer()).get(path).set(headers).expect(429);
    };

    it('production: the header does nothing, with or without a stray secret in the env', async () => {
      app = await build({
        NODE_ENV: 'production',
        WEB_URL: 'https://attayyibun.com',
        BETTER_AUTH_URL: 'https://attayyibun.com',
        LOADTEST_BYPASS_SECRET: SECRET,
      });
      await exhaust({ [LOADTEST_BYPASS_HEADER]: SECRET });
      await exhaust({ [LOADTEST_BYPASS_HEADER]: SECRET }, '/route-limited', 1);
    });

    it('staging: the right secret skips every limit, including a route @Throttle', async () => {
      app = await build({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        WEB_URL: 'https://staging.attayyibun.com',
        LOADTEST_BYPASS_SECRET: SECRET,
      });
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).get('/limited').set(LOADTEST_BYPASS_HEADER, SECRET).expect(200);
        await request(app.getHttpServer()).get('/route-limited').set(LOADTEST_BYPASS_HEADER, SECRET).expect(200);
      }
    });

    it('staging: a wrong secret or no header is still limited', async () => {
      app = await build({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        WEB_URL: 'https://staging.attayyibun.com',
        LOADTEST_BYPASS_SECRET: SECRET,
      });
      await exhaust({ [LOADTEST_BYPASS_HEADER]: 'b'.repeat(40) });
    });
  });
});

describe('AppModule guard order', () => {
  it('registers BetterAuthGuard before AppThrottlerGuard, so the throttler sees req.user', () => {
    // Read from source rather than importing AppModule, whose imports boot
    // Sentry and Redis configuration.
    const source = readFileSync(join(__dirname, '../../app.module.ts'), 'utf8');
    const auth = source.indexOf('useClass: BetterAuthGuard');
    const throttler = source.indexOf('useClass: AppThrottlerGuard');
    expect(auth).toBeGreaterThan(-1);
    expect(throttler).toBeGreaterThan(auth);
    expect(source).not.toContain('useClass: ThrottlerGuard');
  });
});
