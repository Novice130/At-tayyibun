// Run with: pnpm --filter web test  (node:test via tsx)
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";

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
