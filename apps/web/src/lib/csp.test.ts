import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCsp,
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  generateNonce,
  isCspEnforced,
  sentryCspReportUri,
  sentryIngestOrigin,
} from "./csp";

const NONCE = "dGVzdC1ub25jZS0xMjM0NQ==";
const DSN = "https://abc123@o456.ingest.us.sentry.io/789";

function directive(value: string, name: string): string {
  const found = value.split("; ").find((d) => d === name || d.startsWith(`${name} `));
  assert.ok(found, `missing ${name}`);
  return found;
}

describe("buildCsp header name", () => {
  it("is report-only by default", () => {
    assert.equal(buildCsp({ nonce: NONCE, isDev: false }).name, CSP_REPORT_ONLY_HEADER);
    assert.equal(buildCsp({ nonce: NONCE, isDev: true }).name, CSP_REPORT_ONLY_HEADER);
  });

  it("is report-only when the flag is unset, empty or not exactly on", () => {
    for (const v of [undefined, "", "false", "0", "no", "yes", "enforce"]) {
      const enforce = isCspEnforced(v);
      assert.equal(enforce, false, `CSP_ENFORCE=${v}`);
      assert.equal(buildCsp({ nonce: NONCE, isDev: false, enforce }).name, CSP_REPORT_ONLY_HEADER);
    }
  });

  it("enforces when CSP_ENFORCE is true or 1", () => {
    for (const v of ["true", "TRUE", " true ", "1"]) {
      const enforce = isCspEnforced(v);
      assert.equal(enforce, true, `CSP_ENFORCE=${v}`);
      assert.equal(buildCsp({ nonce: NONCE, isDev: false, enforce }).name, CSP_HEADER);
    }
  });
});

describe("buildCsp script-src", () => {
  it("carries the nonce and strict-dynamic", () => {
    const scriptSrc = directive(buildCsp({ nonce: NONCE, isDev: false }).value, "script-src");
    assert.ok(scriptSrc.includes(`'nonce-${NONCE}'`));
    assert.ok(scriptSrc.includes("'strict-dynamic'"));
  });

  it("has no unsafe-eval or unsafe-inline in production", () => {
    const { value } = buildCsp({ nonce: NONCE, isDev: false, enforce: true, sentryDsn: DSN });
    assert.ok(!value.includes("'unsafe-eval'"));
    assert.ok(!directive(value, "script-src").includes("'unsafe-inline'"));
    assert.ok(!directive(value, "connect-src").includes("ws:"));
  });

  it("allows eval and the HMR websocket in dev only", () => {
    const { value } = buildCsp({ nonce: NONCE, isDev: true });
    assert.ok(directive(value, "script-src").includes("'unsafe-eval'"));
    assert.ok(directive(value, "connect-src").includes("ws:"));
  });
});

describe("buildCsp allowlist", () => {
  const { value } = buildCsp({
    nonce: NONCE,
    isDev: false,
    firebaseAuthDomain: "auth.example-app.com",
    sentryDsn: DSN,
  });

  it("allows Firebase Auth and reCAPTCHA", () => {
    const connect = directive(value, "connect-src");
    for (const host of [
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://www.google.com",
    ]) {
      assert.ok(connect.includes(host), host);
    }
    const script = directive(value, "script-src");
    for (const host of [
      "https://apis.google.com",
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
    ]) {
      assert.ok(script.includes(host), host);
    }
    const frame = directive(value, "frame-src");
    for (const host of [
      "https://www.google.com",
      "https://recaptcha.google.com",
      "https://auth.example-app.com",
    ]) {
      assert.ok(frame.includes(host), host);
    }
  });

  it("allows Google and Apple sign-in", () => {
    assert.ok(directive(value, "frame-src").includes("https://accounts.google.com"));
    assert.ok(directive(value, "frame-src").includes("https://appleid.apple.com"));
    assert.ok(directive(value, "form-action").includes("https://accounts.google.com"));
    assert.ok(directive(value, "form-action").includes("https://appleid.apple.com"));
    assert.ok(directive(value, "script-src").includes("https://appleid.cdn-apple.com"));
  });

  it("allows the Sentry ingest host and reports violations to Sentry", () => {
    assert.ok(directive(value, "connect-src").includes("https://o456.ingest.us.sentry.io"));
    assert.equal(
      directive(value, "report-uri"),
      "report-uri https://o456.ingest.us.sentry.io/api/789/security/?sentry_key=abc123",
    );
  });

  it("keeps what the previous static policy allowed", () => {
    assert.equal(directive(value, "default-src"), "default-src 'self'");
    assert.equal(
      directive(value, "style-src"),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
    assert.equal(directive(value, "font-src"), "font-src 'self' data: https://fonts.gstatic.com");
    assert.equal(
      directive(value, "img-src"),
      "img-src 'self' data: blob: https://storage.googleapis.com https://*.googleusercontent.com",
    );
    assert.ok(directive(value, "connect-src").startsWith("connect-src 'self'"));
    assert.ok(directive(value, "connect-src").includes("https://www.googleapis.com"));
    assert.equal(directive(value, "object-src"), "object-src 'none'");
    assert.equal(directive(value, "base-uri"), "base-uri 'self'");
    assert.equal(directive(value, "frame-ancestors"), "frame-ancestors 'none'");
  });

  it("does not put the nonce on styles", () => {
    assert.ok(!directive(value, "style-src").includes("nonce"));
  });
});

describe("buildCsp defaults and hostile input", () => {
  it("falls back to the default Firebase auth domain", () => {
    const { value } = buildCsp({ nonce: NONCE, isDev: false });
    assert.ok(directive(value, "frame-src").includes("https://at-tayyibun-e3f79.firebaseapp.com"));
  });

  it("refuses an auth domain that would inject a directive", () => {
    const { value } = buildCsp({
      nonce: NONCE,
      isDev: false,
      firebaseAuthDomain: "evil.com; script-src *",
    });
    assert.ok(!value.includes("evil.com"));
    assert.ok(directive(value, "frame-src").includes("https://at-tayyibun-e3f79.firebaseapp.com"));
  });

  it("omits report-uri and the Sentry host without a usable DSN", () => {
    for (const dsn of [undefined, "", "not a url", "https://o1.ingest.sentry.io/"]) {
      assert.equal(sentryCspReportUri(dsn), null, String(dsn));
    }
    assert.equal(sentryIngestOrigin(undefined), null);
    const { value } = buildCsp({ nonce: NONCE, isDev: false });
    assert.ok(!value.includes("report-uri"));
    assert.ok(!value.includes("sentry"));
  });
});

describe("generateNonce", () => {
  it("returns 16 random bytes as base64, different every call", () => {
    const a = generateNonce();
    const b = generateNonce();
    assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
    assert.notEqual(a, b);
  });
});
