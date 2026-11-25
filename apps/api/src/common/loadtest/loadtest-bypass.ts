import { ExecutionContext } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Lets a staging load test past the rate limits. See loadtest/RUNBOOK.md.
 *
 * NODE_ENV cannot tell staging from production: both run NODE_ENV=production
 * (Dockerfile.api, and both compose files). What really differs is the site URL
 * in WEB_URL and BETTER_AUTH_URL, so this is an allow-list on those, plus an
 * explicit APP_ENV=staging that production never sets. All must hold, and any
 * doubt turns it off.
 *
 * apps/web/src/lib/loadtest-bypass.ts applies the same rule to Better Auth.
 * Keep the two identical.
 */
export const LOADTEST_BYPASS_HEADER = 'x-loadtest-bypass';

const MIN_SECRET_LENGTH = 32;
const ALLOWED_SITE_HOSTS = new Set(['staging.attayyibun.com', 'localhost', '127.0.0.1']);

type Env = Record<string, string | undefined>;

function isAllowedSiteUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return !url.username && !url.password && ALLOWED_SITE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** The secret, or null when the bypass may not be active in this environment. */
export function loadtestBypassSecret(env: Env): string | null {
  const secret = env.LOADTEST_BYPASS_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  if (env.APP_ENV !== 'staging') return null;
  if (env.SENTRY_ENVIRONMENT?.trim().toLowerCase() === 'production') return null;

  const siteUrls = [env.WEB_URL, env.BETTER_AUTH_URL].filter((u): u is string => !!u);
  if (siteUrls.length === 0 || !siteUrls.every(isAllowedSiteUrl)) return null;
  return secret;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * The throttler's skipIf, or undefined when the bypass is off, so a production
 * guard has no skip path to reach. Hashing first keeps the comparison constant
 * time when the lengths differ.
 */
export function createLoadtestSkipIf(env: Env): ((context: ExecutionContext) => boolean) | undefined {
  const secret = loadtestBypassSecret(env);
  if (!secret) return undefined;
  const expected = sha256(secret);
  console.warn('[loadtest] rate-limit bypass is ACTIVE for requests carrying the secret header');
  return (context) => {
    const supplied = context.switchToHttp().getRequest().headers?.[LOADTEST_BYPASS_HEADER];
    return typeof supplied === 'string' && timingSafeEqual(sha256(supplied), expected);
  };
}
