// The real options object, imported with a dummy database URL that is never
// connected to. auth-flows.test.ts proves how these settings behave.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";

let options: any;

describe("auth options", () => {
  before(async () => {
    process.env.DATABASE_URL = "postgres://test@127.0.0.1:1/unused";
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
    ({ auth: { options } } = await import("./auth"));
  });

  it("gives sign-up one answer for new and existing addresses", () => {
    assert.equal(options.emailAndPassword.autoSignIn, false);
  });

  it("gives the stand-in user every field of a real user row", async () => {
    const { auth } = await import("./auth");
    const { tables } = await auth.$context;
    const synthetic = options.emailAndPassword.customSyntheticUser({
      coreFields: { name: "A", email: "a@example.com", emailVerified: false, image: null },
      additionalFields: { termsAcceptedAt: new Date() },
      id: "id",
    });
    for (const field of Object.keys(tables.user.fields)) {
      if (["createdAt", "updatedAt"].includes(field)) continue;
      assert.ok(field in synthetic, `stand-in user is missing ${field}`);
    }
  });

  it("does not swap an email address before it is confirmed", () => {
    assert.equal(options.user.changeEmail.updateEmailWithoutVerification, false);
  });

  it("does not trust the retired traefik.me origin", () => {
    assert.ok(!options.trustedOrigins.some((origin: string) => origin.includes("traefik.me")));
  });

  it("stores the second-factor stamp and keeps it out of client input", () => {
    const field = options.session.additionalFields.twoFactorVerified;
    assert.equal(field.input, false);
    assert.equal(typeof options.databaseHooks.session.create.before, "function");
  });
});
