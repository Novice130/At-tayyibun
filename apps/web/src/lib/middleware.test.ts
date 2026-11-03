import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const forwarded = (res: Response) => res.headers.get("x-middleware-request-x-admin-exempt");

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://attayyibun.com${path}`, { headers });
}

describe("middleware x-admin-exempt", () => {
  it("sets the header for the 2FA challenge page", () => {
    assert.equal(forwarded(middleware(request("/admin/security/challenge"))), "1");
  });

  it("strips a client-sent header from other admin pages", () => {
    const res = middleware(
      request("/admin/users", { "x-admin-exempt": "1", cookie: "better-auth.session_token=x" }),
    );
    assert.equal(forwarded(res), null);
    assert.ok(!(res.headers.get("x-middleware-override-headers") ?? "").includes("x-admin-exempt"));
    assert.equal(res.headers.get("x-middleware-next"), "1");
  });

  it("does not let the header past the cookie gate", () => {
    const res = middleware(request("/admin/users", { "x-admin-exempt": "1" }));
    assert.equal(res.status, 307);
    assert.ok(res.headers.get("location")?.endsWith("/login"));
  });

  it("does not exempt a path that merely starts like the challenge page", () => {
    const res = middleware(request("/admin/security/challenge-other"));
    assert.equal(forwarded(res), null);
    assert.equal(res.status, 307);
  });
});

describe("middleware CSP", () => {
  const nonceOf = (res: Response) => res.headers.get("x-middleware-request-x-nonce");

  it("sends a report-only policy with a fresh nonce that Next can read", () => {
    const a = middleware(request("/about"));
    const b = middleware(request("/about"));
    const nonce = nonceOf(a);
    assert.ok(nonce);
    assert.notEqual(nonce, nonceOf(b));
    const policy = a.headers.get("content-security-policy-report-only");
    assert.ok(policy?.includes(`'nonce-${nonce}'`));
    assert.equal(a.headers.get("content-security-policy"), null);
    // Next takes the nonce for its own scripts from the CSP request header.
    assert.equal(a.headers.get("x-middleware-request-content-security-policy-report-only"), policy);
  });

  it("enforces when CSP_ENFORCE=true", () => {
    const prev = process.env.CSP_ENFORCE;
    process.env.CSP_ENFORCE = "true";
    try {
      const res = middleware(request("/about"));
      assert.ok(res.headers.get("content-security-policy")?.includes("'strict-dynamic'"));
      assert.equal(res.headers.get("content-security-policy-report-only"), null);
    } finally {
      if (prev === undefined) delete process.env.CSP_ENFORCE;
      else process.env.CSP_ENFORCE = prev;
    }
  });

  it("replaces a client-sent nonce or policy", () => {
    const res = middleware(
      request("/about", {
        "x-nonce": "attacker",
        "content-security-policy": "script-src 'nonce-attacker'",
      }),
    );
    assert.notEqual(nonceOf(res), "attacker");
    assert.ok(!(res.headers.get("x-middleware-override-headers") ?? "").split(",").includes("content-security-policy"));
  });

  it("covers redirects and the admin pages", () => {
    assert.ok(middleware(request("/browse")).headers.get("content-security-policy-report-only"));
    const challenge = middleware(request("/admin/security/challenge"));
    assert.ok(nonceOf(challenge));
    assert.ok(challenge.headers.get("content-security-policy-report-only"));
  });

  it("leaves /api to the API's own headers", () => {
    for (const path of ["/api", "/api/session/health"]) {
      const res = middleware(request(path));
      assert.equal(res.headers.get("content-security-policy-report-only"), null, path);
      assert.equal(res.headers.get("content-security-policy"), null, path);
      assert.equal(nonceOf(res), null, path);
    }
    assert.ok(middleware(request("/apiary")).headers.get("content-security-policy-report-only"));
  });
});
