import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import {
  LOADTEST_BYPASS_HEADER,
  loadtestBypassSecret,
  withLoadtestBypass,
} from "./loadtest-bypass";

const SECRET = "a".repeat(40);
const STAGING = {
  NODE_ENV: "production",
  APP_ENV: "staging",
  SENTRY_ENVIRONMENT: "staging",
  BETTER_AUTH_URL: "https://staging.attayyibun.com",
  LOADTEST_BYPASS_SECRET: SECRET,
};
const PRODUCTION = {
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://attayyibun.com",
  LOADTEST_BYPASS_SECRET: SECRET,
};

describe("loadtestBypassSecret", () => {
  it("is active on staging despite NODE_ENV=production", () => {
    assert.equal(loadtestBypassSecret(STAGING), SECRET);
  });

  const off: [string, Record<string, string | undefined>][] = [
    ["production env file with a stray secret", PRODUCTION],
    ["APP_ENV=staging copied onto production", { ...PRODUCTION, APP_ENV: "staging" }],
    ["APP_ENV=production", { ...STAGING, APP_ENV: "production" }],
    ["APP_ENV unset", { ...STAGING, APP_ENV: undefined }],
    ["SENTRY_ENVIRONMENT=production", { ...STAGING, SENTRY_ENVIRONMENT: "production" }],
    ["WEB_URL production", { ...STAGING, WEB_URL: "https://attayyibun.com" }],
    // auth.ts falls back to the production URL when no site URL is set.
    ["no site URL", { ...STAGING, BETTER_AUTH_URL: undefined }],
    ["lookalike host", { ...STAGING, BETTER_AUTH_URL: "https://staging.attayyibun.com.evil.example" }],
    ["short secret", { ...STAGING, LOADTEST_BYPASS_SECRET: "x".repeat(31) }],
    ["no secret", { ...STAGING, LOADTEST_BYPASS_SECRET: undefined }],
  ];
  for (const [label, env] of off) {
    it(`is off: ${label}`, () => assert.equal(loadtestBypassSecret(env), null));
  }
});

describe("withLoadtestBypass", () => {
  const rules = { "/ok": { window: 60, max: 1 } };

  it("returns the very same rules in production: nothing is wrapped", () => {
    assert.equal(withLoadtestBypass(rules, PRODUCTION), rules);
  });

  // The real Better Auth limiter, so a change in how it reads custom rules fails here.
  function authWith(env: Record<string, string | undefined>) {
    return betterAuth({
      baseURL: "http://localhost:3000",
      basePath: "/auth",
      secret: "s".repeat(32),
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      rateLimit: {
        enabled: true,
        window: 60,
        max: 1,
        storage: "memory",
        customRules: withLoadtestBypass(rules, env),
      },
      advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    });
  }

  // Each test gets its own address: the limiter's memory store is module-wide.
  let lastOctet = 0;
  const freshIp = () => `203.0.113.${++lastOctet}`;

  async function statuses(
    env: Record<string, string | undefined>,
    path: string,
    extra: Record<string, string> = {},
  ) {
    const auth = authWith(env);
    const ip = freshIp();
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await auth.handler(
        new Request(`http://localhost:3000/auth${path}`, {
          headers: { "cf-connecting-ip": ip, ...extra },
        }),
      );
      out.push(res.status);
    }
    return out;
  }

  const local = { ...STAGING, BETTER_AUTH_URL: "http://localhost:3000" };
  const withSecret = { [LOADTEST_BYPASS_HEADER]: SECRET };

  it("production: the secret header changes nothing", async () => {
    const prod = { ...PRODUCTION };
    assert.deepEqual((await statuses(prod, "/ok", withSecret)).slice(1), [429, 429]);
  });

  it("staging: the right secret skips a listed rule", async () => {
    assert.ok((await statuses(local, "/ok", withSecret)).every((s) => s === 200));
  });

  it("staging: the right secret skips the global limit on an unlisted path", async () => {
    assert.ok(!(await statuses(local, "/error", withSecret)).includes(429));
  });

  it("staging: without the header, a listed rule still applies", async () => {
    assert.deepEqual((await statuses(local, "/ok")).slice(1), [429, 429]);
  });

  it("staging: without the header, the global limit still applies on an unlisted path", async () => {
    assert.deepEqual((await statuses(local, "/error")).slice(1), [429, 429]);
  });

  it("staging: a wrong secret is still limited", async () => {
    const wrong = { [LOADTEST_BYPASS_HEADER]: "b".repeat(40) };
    assert.deepEqual((await statuses(local, "/ok", wrong)).slice(1), [429, 429]);
  });
});
