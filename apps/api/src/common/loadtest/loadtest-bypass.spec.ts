import { ExecutionContext } from '@nestjs/common';
import {
  createLoadtestSkipIf,
  LOADTEST_BYPASS_HEADER,
  loadtestBypassSecret,
} from './loadtest-bypass';

const SECRET = 'a'.repeat(40);

// What staging runs: note NODE_ENV=production, set by the compose file and image.
const STAGING = {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  SENTRY_ENVIRONMENT: 'staging',
  WEB_URL: 'https://staging.attayyibun.com',
  BETTER_AUTH_URL: 'https://staging.attayyibun.com',
  LOADTEST_BYPASS_SECRET: SECRET,
};

function ctx(headers: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

describe('loadtestBypassSecret', () => {
  it('is active on staging even though staging runs NODE_ENV=production', () => {
    expect(loadtestBypassSecret(STAGING)).toBe(SECRET);
  });

  it('is active for a local server', () => {
    expect(
      loadtestBypassSecret({
        APP_ENV: 'staging',
        WEB_URL: 'http://localhost:3000',
        LOADTEST_BYPASS_SECRET: SECRET,
      }),
    ).toBe(SECRET);
  });

  describe('stays off in production, whichever single setting is wrong', () => {
    it.each([
      ['WEB_URL is production', { WEB_URL: 'https://attayyibun.com' }],
      ['WEB_URL is www production', { WEB_URL: 'https://www.attayyibun.com' }],
      ['WEB_URL is the production origin alias', { WEB_URL: 'https://hz-attayyibun.learnnovice.com' }],
      ['BETTER_AUTH_URL is production', { BETTER_AUTH_URL: 'https://attayyibun.com' }],
      ['APP_ENV is production', { APP_ENV: 'production' }],
      ['APP_ENV has odd case', { APP_ENV: 'Staging' }],
      ['APP_ENV is unset', { APP_ENV: undefined }],
      ['SENTRY_ENVIRONMENT is production', { SENTRY_ENVIRONMENT: 'production' }],
      ['SENTRY_ENVIRONMENT is Production', { SENTRY_ENVIRONMENT: 'Production' }],
    ])('%s', (_label, override) => {
      expect(loadtestBypassSecret({ ...STAGING, ...override })).toBeNull();
    });

    it('with the production env file exactly, plus a stray secret', () => {
      // Mirrors infra/hetzner/sites/attayyibun/api.env.example.
      expect(
        loadtestBypassSecret({
          NODE_ENV: 'production',
          WEB_URL: 'https://attayyibun.com',
          BETTER_AUTH_URL: 'https://attayyibun.com',
          LOADTEST_BYPASS_SECRET: SECRET,
        }),
      ).toBeNull();
    });

    it('even if APP_ENV=staging is copied onto production by mistake', () => {
      expect(
        loadtestBypassSecret({
          ...STAGING,
          WEB_URL: 'https://attayyibun.com',
          BETTER_AUTH_URL: 'https://attayyibun.com',
        }),
      ).toBeNull();
    });
  });

  describe('fails closed', () => {
    it.each([
      ['no secret', { LOADTEST_BYPASS_SECRET: undefined }],
      ['empty secret', { LOADTEST_BYPASS_SECRET: '' }],
      ['short secret', { LOADTEST_BYPASS_SECRET: 'x'.repeat(31) }],
      ['no site URLs', { WEB_URL: undefined, BETTER_AUTH_URL: undefined }],
      ['unparseable URL', { WEB_URL: 'not a url' }],
      ['unlisted host', { WEB_URL: 'https://example.com' }],
      ['lookalike host', { WEB_URL: 'https://staging.attayyibun.com.evil.example' }],
      ['userinfo trick', { WEB_URL: 'https://staging.attayyibun.com@attayyibun.com' }],
      ['one URL good, one unset-but-bad', { BETTER_AUTH_URL: 'https://attayyibun.com/' }],
    ])('%s', (_label, override) => {
      expect(loadtestBypassSecret({ ...STAGING, ...override })).toBeNull();
    });
  });
});

describe('createLoadtestSkipIf', () => {
  it('returns undefined in production, so the guard has no skip path at all', () => {
    expect(
      createLoadtestSkipIf({
        NODE_ENV: 'production',
        WEB_URL: 'https://attayyibun.com',
        LOADTEST_BYPASS_SECRET: SECRET,
      }),
    ).toBeUndefined();
  });

  describe('on staging', () => {
    const skipIf = createLoadtestSkipIf(STAGING)!;

    it('skips with the right secret', () => {
      expect(skipIf(ctx({ [LOADTEST_BYPASS_HEADER]: SECRET }))).toBe(true);
    });

    it.each([
      ['no header', {}],
      ['wrong secret, same length', { [LOADTEST_BYPASS_HEADER]: 'b'.repeat(40) }],
      ['prefix of the secret', { [LOADTEST_BYPASS_HEADER]: SECRET.slice(0, 39) }],
      ['secret plus suffix', { [LOADTEST_BYPASS_HEADER]: `${SECRET}x` }],
      ['empty', { [LOADTEST_BYPASS_HEADER]: '' }],
      ['array value', { [LOADTEST_BYPASS_HEADER]: [SECRET, SECRET] }],
    ])('does not skip: %s', (_label, headers) => {
      expect(skipIf(ctx(headers))).toBe(false);
    });
  });
});
