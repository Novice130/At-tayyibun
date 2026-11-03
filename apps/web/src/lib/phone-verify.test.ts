// Run with: pnpm --filter web test  (node:test via tsx)
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import type { GenericEndpointContext } from "better-auth";

// Next's global types mark NODE_ENV read-only; the test needs to set it.
const env = process.env as Record<string, string | undefined>;

const FIREBASE_VARS = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];

describe("firebaseVerifyOTP without Firebase configured", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["NODE_ENV", "DATABASE_URL", ...FIREBASE_VARS]) saved[key] = env[key];
    for (const key of FIREBASE_VARS) delete env[key];
    // Never connected to: every path under test returns before touching the DB.
    // Set only so importing ./db does not log a missing-URL error.
    env.DATABASE_URL = "postgres://test@127.0.0.1:1/unused";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    mock.restoreAll();
  });

  // Staging and development included: staging holds a copy of real members, and
  // this endpoint signs a session-less caller in as the owner of the number.
  for (const nodeEnv of ["production", "staging", "development", "test"]) {
    it(`refuses any code when NODE_ENV=${nodeEnv} and logs why`, async () => {
      env.NODE_ENV = nodeEnv;
      const errorLog = mock.method(console, "error", () => {});
      const { firebaseVerifyOTP } = await import("./phone-verify");

      // Long enough to have passed the old length-only check.
      const ok = await firebaseVerifyOTP({
        phoneNumber: "+15555550100",
        code: "x".repeat(64),
      });

      assert.equal(ok, false);
      assert.ok(
        errorLog.mock.calls.some((call) => String(call.arguments[0]).includes("REFUSED")),
        "expected a server log line explaining the refusal",
      );
    });
  }

  it("rejects an empty code", async () => {
    const { firebaseVerifyOTP } = await import("./phone-verify");
    assert.equal(await firebaseVerifyOTP({ phoneNumber: "+15555550100", code: "" }), false);
  });
});

describe("maskPhone", () => {
  it("keeps only the last four digits", async () => {
    const { maskPhone } = await import("./phone-verify");
    assert.equal(maskPhone("+15555550100"), "***0100");
  });

  it("shows nothing of a short or missing value", async () => {
    const { maskPhone } = await import("./phone-verify");
    assert.equal(maskPhone("123"), "***");
    assert.equal(maskPhone(undefined), "***");
  });
});

describe("firebaseVerifyOTP replay guard", () => {
  const PHONE = "+15555550100";
  const TOKEN = "firebase-id-token-under-test";
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const key of ["DATABASE_URL", ...FIREBASE_VARS]) saved[key] = env[key];
    // Never connected to: db.update is mocked below. Set only so importing ./db
    // does not log a missing-URL error.
    env.DATABASE_URL = "postgres://test@127.0.0.1:1/unused";
    // A throwaway key so firebase-admin builds a real Auth instance offline;
    // its verifyIdToken is replaced per test, so nothing ever calls Google.
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    env.FIREBASE_PROJECT_ID = "test-project";
    env.FIREBASE_CLIENT_EMAIL = "test@test-project.iam.gserviceaccount.com";
    env.FIREBASE_PRIVATE_KEY = privateKey;

    const { firebaseAuth } = await import("./firebase-admin");
    const now = Math.floor(Date.now() / 1000);
    mock.method(firebaseAuth(), "verifyIdToken", async () => ({
      uid: "firebase-uid",
      phone_number: PHONE,
      auth_time: now - 5,
      exp: now + 3600,
      firebase: { sign_in_provider: "phone" },
    }));

    // clearStalePhoneClaims runs on success; keep it off the network.
    const { db } = await import("./db");
    mock.method(db, "update", () => ({ set: () => ({ where: async () => undefined }) }));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    mock.restoreAll();
  });

  /** Just enough of better-auth's endpoint context for the replay guard. */
  function ctxWith(adapter: {
    findVerificationValue: (identifier: string) => Promise<unknown>;
    createVerificationValue: (data: Record<string, unknown>) => Promise<unknown>;
  }) {
    return { context: { internalAdapter: adapter } } as unknown as GenericEndpointContext;
  }

  function memoryAdapter() {
    const rows = new Map<string, Record<string, unknown>>();
    return {
      rows,
      findVerificationValue: async (identifier: string) => rows.get(identifier) ?? null,
      createVerificationValue: async (data: Record<string, unknown>) => {
        rows.set(String(data.identifier), data);
        return data;
      },
    };
  }

  /** Every argument of every console call, flattened to text. */
  function logged(...spies: Array<{ mock: { calls: Array<{ arguments: unknown[] }> } }>) {
    return spies
      .flatMap((spy) => spy.mock.calls.flatMap((call) => call.arguments))
      .map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg)))
      .join("\n");
  }

  it("accepts a fresh token and records it", async () => {
    const { firebaseVerifyOTP } = await import("./phone-verify");
    const adapter = memoryAdapter();

    assert.equal(await firebaseVerifyOTP({ phoneNumber: PHONE, code: TOKEN }, ctxWith(adapter)), true);
    assert.equal(adapter.rows.size, 1, "expected the token to be burned");
  });

  it("rejects the same token a second time", async () => {
    mock.method(console, "warn", () => {});
    const { firebaseVerifyOTP } = await import("./phone-verify");
    const adapter = memoryAdapter();

    assert.equal(await firebaseVerifyOTP({ phoneNumber: PHONE, code: TOKEN }, ctxWith(adapter)), true);
    assert.equal(await firebaseVerifyOTP({ phoneNumber: PHONE, code: TOKEN }, ctxWith(adapter)), false);
  });

  it("rejects when the replay lookup cannot reach the database, without logging the token or number", async () => {
    const errorLog = mock.method(console, "error", () => {});
    const warnLog = mock.method(console, "warn", () => {});
    const { firebaseVerifyOTP } = await import("./phone-verify");
    const created: unknown[] = [];
    // Shaped like drizzle's DrizzleQueryError, whose message carries the params.
    const dbError = new Error(`Failed query: select ...\nparams: ${TOKEN},${PHONE}`);

    const ok = await firebaseVerifyOTP(
      { phoneNumber: PHONE, code: TOKEN },
      ctxWith({
        findVerificationValue: async () => {
          throw dbError;
        },
        createVerificationValue: async (data) => created.push(data),
      }),
    );

    assert.equal(ok, false);
    assert.equal(created.length, 0);
    assert.ok(errorLog.mock.calls.length > 0, "expected the failure to be logged");
    const text = logged(errorLog, warnLog);
    assert.ok(!text.includes(TOKEN), "token leaked into logs");
    assert.ok(!text.includes(PHONE), "phone number leaked into logs");
  });

  it("rejects when recording the token fails", async () => {
    mock.method(console, "error", () => {});
    const { firebaseVerifyOTP } = await import("./phone-verify");

    const ok = await firebaseVerifyOTP(
      { phoneNumber: PHONE, code: TOKEN },
      ctxWith({
        findVerificationValue: async () => null,
        createVerificationValue: async () => {
          throw new Error("connection terminated unexpectedly");
        },
      }),
    );

    assert.equal(ok, false);
  });

  it("rejects when no adapter is available to run the replay guard", async () => {
    mock.method(console, "error", () => {});
    const { firebaseVerifyOTP } = await import("./phone-verify");

    assert.equal(await firebaseVerifyOTP({ phoneNumber: PHONE, code: TOKEN }), false);
  });
});
