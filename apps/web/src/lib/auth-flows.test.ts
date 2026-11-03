// Drives the real Better Auth endpoints against its in-memory adapter, so these
// tests catch a Better Auth upgrade that changes a path or a session flow the
// admin 2FA check depends on. No database or network is involved.
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import { provedSecondFactor, secondFactorSessionHook } from "./second-factor-session";
import { assertImageWritable } from "./avatar-url";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

type Row = Record<string, any>;

function setup() {
  const store: Record<string, Row[]> = { user: [], session: [], account: [], verification: [], twoFactor: [] };
  const otps: string[] = [];
  const mails: Array<{ to: string; url: string }> = [];
  const auth = betterAuth({
    baseURL: ORIGIN,
    basePath: "/auth",
    secret: "test-secret-test-secret-test-secret",
    trustedOrigins: [ORIGIN],
    database: memoryAdapter(store),
    rateLimit: { enabled: false },
    logger: { disabled: true },
    emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: false },
    emailVerification: {
      async sendVerificationEmail({ user, url }) {
        mails.push({ to: user.email, url });
      },
    },
    session: {
      additionalFields: { twoFactorVerified: { type: "boolean", required: false, defaultValue: false, input: false } },
    },
    user: { changeEmail: { enabled: true, updateEmailWithoutVerification: false } },
    plugins: [
      phoneNumber({ sendOTP: async () => {}, verifyOTP: async () => true }),
      twoFactor({ otpOptions: { sendOTP: async ({ otp }) => void otps.push(otp) } }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: secondFactorSessionHook(
            async (userId) => store.user.find((u) => u.id === userId)?.twoFactorEnabled === true,
          ),
        },
      },
      user: {
        update: {
          before: async (user, ctx) => {
            assertImageWritable((user as { image?: string | null }).image, ctx?.path, [ORIGIN]);
            return { data: user };
          },
        },
      },
    },
  });

  const newJar = () => {
    const jar = new Map<string, string>();
    const call = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
      const res = await auth.handler(
        new Request(`${ORIGIN}/auth${path}`, {
          method,
          headers: {
            origin: ORIGIN,
            "content-type": "application/json",
            cookie: Array.from(jar, ([k, v]) => `${k}=${v}`).join("; "),
          },
          body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        }),
      );
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq);
        if (/max-age=0/i.test(line) || pair.slice(eq + 1) === "") jar.delete(name);
        else jar.set(name, pair.slice(eq + 1));
      }
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, cookies: res.headers.getSetCookie() };
    };
    return { call, jar };
  };

  return { auth, store, otps, mails, newJar };
}

type Harness = ReturnType<typeof setup>;
const EMAIL = "admin@example.com";

const latestSession = (h: Harness) => h.store.session[h.store.session.length - 1];

async function register(h: Harness) {
  const res = await h.newJar().call("/sign-up/email", { email: EMAIL, password: PASSWORD, name: "A" });
  assert.equal(res.status, 200);
}

async function enrol(h: Harness) {
  const client = h.newJar();
  assert.equal((await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD })).status, 200);
  assert.equal((await client.call("/two-factor/enable", { password: PASSWORD })).status, 200);
  assert.equal((await client.call("/two-factor/send-otp", {})).status, 200);
  const verified = await client.call("/two-factor/verify-otp", { code: h.otps.at(-1) });
  assert.equal(verified.status, 200);
  return client;
}

describe("admin second-factor stamp", () => {
  let h: Harness;
  beforeEach(async () => {
    h = setup();
    await register(h);
  });

  it("leaves an unenrolled password session unstamped", async () => {
    const client = h.newJar();
    await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });
    assert.equal(latestSession(h).twoFactorVerified, false);
  });

  it("stamps the session that completes enrolment", async () => {
    await enrol(h);
    assert.equal(h.store.user[0].twoFactorEnabled, true);
    assert.equal(latestSession(h).twoFactorVerified, true);
  });

  it("stamps a session only after the sign-in challenge is answered", async () => {
    await enrol(h);
    const client = h.newJar();
    const signIn = await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });
    assert.equal(signIn.body.twoFactorRedirect, true);
    assert.equal(client.jar.size > 0, true);
    assert.equal(
      Array.from(client.jar.keys()).some((name) => name.endsWith("session_token")),
      false,
      "no usable session before the second factor",
    );

    await client.call("/two-factor/send-otp", {});
    const verified = await client.call("/two-factor/verify-otp", { code: h.otps.at(-1) });
    assert.equal(verified.status, 200);
    const row = h.store.session.find((s) => s.token === verified.body.token);
    assert.equal(row?.twoFactorVerified, true);
  });

  it("stamps a trusted-device sign-in, which that device already proved", async () => {
    await enrol(h);
    const client = h.newJar();
    await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });
    await client.call("/two-factor/send-otp", {});
    await client.call("/two-factor/verify-otp", { code: h.otps.at(-1), trustDevice: true });

    const again = await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });
    assert.equal(again.body.twoFactorRedirect, undefined);
    assert.equal(h.store.session.find((s) => s.token === again.body.token)?.twoFactorVerified, true);
  });

  it("does not stamp phone-number verify, even for an enrolled admin", async () => {
    await enrol(h);
    Object.assign(h.store.user[0], { phoneNumber: "+15555550100", phoneNumberVerified: true });
    const client = h.newJar();
    const res = await client.call("/phone-number/verify", { phoneNumber: "+15555550100", code: "123456" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, "the plugin still signs the person in as a member");
    assert.equal(h.store.session.find((s) => s.token === res.body.token)?.twoFactorVerified, false);
  });

  it("does not stamp an unstamped session by answering a code on it", async () => {
    await enrol(h);
    Object.assign(h.store.user[0], { phoneNumber: "+15555550100", phoneNumberVerified: true });
    const client = h.newJar();
    const res = await client.call("/phone-number/verify", { phoneNumber: "+15555550100", code: "123456" });
    await client.call("/two-factor/send-otp", {});
    await client.call("/two-factor/verify-otp", { code: h.otps.at(-1) });
    assert.equal(h.store.session.find((s) => s.token === res.body.token)?.twoFactorVerified, false);
  });
});

describe("provedSecondFactor by path", () => {
  const enrolled = async () => true;
  for (const path of ["/phone-number/verify", "/callback/:id", "/sign-in/social", "/verify-email", "/change-password"]) {
    it(`does not trust ${path}`, async () => assert.equal(await provedSecondFactor(path, "u", enrolled), false));
  }
  it("does not trust a missing path", async () => {
    assert.equal(await provedSecondFactor(undefined, "u", enrolled), false);
  });
  it("fails closed if the enrolment lookup fails", async () => {
    const broken = async () => {
      throw new Error("db down");
    };
    assert.equal(await provedSecondFactor("/sign-in/email", "u", broken), false);
  });
});

describe("sign-up does not reveal membership", () => {
  let h: Harness;
  before(() => {
    h = setup();
  });

  it("answers a new and an existing address the same way", async () => {
    const first = await h.newJar().call("/sign-up/email", { email: EMAIL, password: PASSWORD, name: "A" });
    const second = await h.newJar().call("/sign-up/email", { email: EMAIL, password: "another-password-1", name: "A" });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.token, null);
    assert.equal(second.body.token, null);
    // Body shape against a real row is checked in auth-config.test.ts: this
    // adapter leaves out unset fields, which a database row would return as null.
    assert.equal(first.cookies.length, 0);
    assert.equal(second.cookies.length, 0);
  });
});

describe("email change needs proof", () => {
  it("keeps the old address on an unverified account until the new one is confirmed", async () => {
    const h = setup();
    await register(h);
    const client = h.newJar();
    await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });

    const res = await client.call("/change-email", { newEmail: "victim@example.com" });
    assert.equal(res.status, 200);
    assert.equal(h.store.user[0].email, EMAIL, "not swapped before the link is opened");
    assert.equal(h.mails.at(-1)?.to, "victim@example.com");

    const path = new URL(h.mails.at(-1)!.url).pathname.replace(/^\/auth/, "") + new URL(h.mails.at(-1)!.url).search;
    await client.call(path);
    assert.equal(h.store.user[0].email, "victim@example.com");
    assert.equal(h.store.user[0].emailVerified, true);
  });
});

describe("image writes", () => {
  it("refuses an outside image through /update-user and accepts a preset", async () => {
    const h = setup();
    await register(h);
    const client = h.newJar();
    await client.call("/sign-in/email", { email: EMAIL, password: PASSWORD });

    const bad = await client.call("/update-user", { image: "https://evil.example/x.png" });
    assert.equal(bad.status, 400);
    assert.equal(h.store.user[0].image ?? null, null);

    const good = await client.call("/update-user", { image: `${ORIGIN}/avatars/male/male-1.jpg` });
    assert.equal(good.status, 200);
    assert.equal(h.store.user[0].image, `${ORIGIN}/avatars/male/male-1.jpg`);
  });
});
