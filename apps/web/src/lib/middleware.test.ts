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
