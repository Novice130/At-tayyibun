import { createHash, timingSafeEqual } from "crypto";

// Lets a staging load test past Better Auth's limiter. See loadtest/RUNBOOK.md.
//
// NODE_ENV cannot tell staging from production: both run NODE_ENV=production
// (Dockerfile.web). What really differs is the site URL, so this is an
// allow-list on it, plus an explicit APP_ENV=staging production never sets.
//
// apps/api/src/common/loadtest/loadtest-bypass.ts applies the same rule to the
// API. Keep the two identical.
export const LOADTEST_BYPASS_HEADER = "x-loadtest-bypass";

const MIN_SECRET_LENGTH = 32;
const ALLOWED_SITE_HOSTS = new Set(["staging.attayyibun.com", "localhost", "127.0.0.1"]);

type Env = Record<string, string | undefined>;
type Rule = { window: number; max: number };
type RuleFn = (request: Request, current: Rule) => false | Rule;

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
  if (env.APP_ENV !== "staging") return null;
  if (env.SENTRY_ENVIRONMENT?.trim().toLowerCase() === "production") return null;

  const siteUrls = [env.WEB_URL, env.BETTER_AUTH_URL].filter((u): u is string => !!u);
  if (siteUrls.length === 0 || !siteUrls.every(isAllowedSiteUrl)) return null;
  return secret;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Better Auth's customRules, unchanged when the bypass is off, so production
 * runs exactly the rules it was given. When on, a request with the secret gets
 * `false` (no limit) from every rule, and a trailing catch-all covers paths on
 * the global limit. Better Auth uses the first key that matches, so the listed
 * rules keep their limits for everyone else.
 */
export function withLoadtestBypass<T extends Record<string, Rule>>(
  rules: T,
  env: Env = process.env,
): T | Record<string, RuleFn> {
  const secret = loadtestBypassSecret(env);
  if (!secret) return rules;
  const expected = sha256(secret);
  console.warn("[loadtest] rate-limit bypass is ACTIVE for requests carrying the secret header");

  const hasSecret = (request: Request) => {
    const supplied = request.headers.get(LOADTEST_BYPASS_HEADER);
    return supplied !== null && timingSafeEqual(sha256(supplied), expected);
  };

  const wrapped: Record<string, RuleFn> = {};
  for (const [path, rule] of Object.entries(rules)) {
    wrapped[path] = (request) => (hasSecret(request) ? false : rule);
  }
  wrapped["/**"] = (request, current) => (hasSecret(request) ? false : current);
  return wrapped;
}
