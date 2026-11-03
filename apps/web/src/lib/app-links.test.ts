import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { config, middleware } from "../middleware";
import { GET as getAssetLinks } from "../app/.well-known/assetlinks.json/route";
import { GET as getAasa } from "../app/.well-known/apple-app-site-association/route";
import { ANDROID_PACKAGE_NAME, APP_LINK_PATHS, IOS_APP_ID, androidCertFingerprints, assetLinks } from "./app-links";

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");

describe("app link verification files", () => {
  it("serves assetlinks.json as JSON for the Android package once a fingerprint is set", async () => {
    const before = process.env.ANDROID_APP_SHA256_FINGERPRINTS;
    process.env.ANDROID_APP_SHA256_FINGERPRINTS = FP.toLowerCase();
    try {
      const res = getAssetLinks();
      assert.equal(res.headers.get("content-type"), "application/json");
      const body = await res.json();
      assert.equal(body.length, 1);
      assert.deepEqual(body[0].relation, ["delegate_permission/common.handle_all_urls"]);
      assert.equal(body[0].target.namespace, "android_app");
      assert.equal(body[0].target.package_name, "com.attayyibun.at_tayyibun");
      assert.equal(body[0].target.package_name, ANDROID_PACKAGE_NAME);
      assert.deepEqual(body[0].target.sha256_cert_fingerprints, [FP]);
    } finally {
      if (before === undefined) delete process.env.ANDROID_APP_SHA256_FINGERPRINTS;
      else process.env.ANDROID_APP_SHA256_FINGERPRINTS = before;
    }
  });

  it("404s assetlinks.json rather than publish a missing or malformed fingerprint", () => {
    const before = process.env.ANDROID_APP_SHA256_FINGERPRINTS;
    try {
      delete process.env.ANDROID_APP_SHA256_FINGERPRINTS;
      assert.equal(getAssetLinks().status, 404);
      process.env.ANDROID_APP_SHA256_FINGERPRINTS = "REPLACE_ME";
      assert.equal(getAssetLinks().status, 404);
    } finally {
      if (before === undefined) delete process.env.ANDROID_APP_SHA256_FINGERPRINTS;
      else process.env.ANDROID_APP_SHA256_FINGERPRINTS = before;
    }
  });

  it("parses a comma-separated fingerprint list and drops bad entries", () => {
    assert.deepEqual(androidCertFingerprints(` ${FP} , nope, "${FP.toLowerCase()}"`), [FP, FP]);
    assert.equal(assetLinks([]), null);
  });

  it("serves apple-app-site-association as JSON for the iOS app", async () => {
    const res = getAasa();
    assert.equal(res.headers.get("content-type"), "application/json");
    const body = await res.json();
    const [detail] = body.applinks.details;
    assert.deepEqual(detail.appIDs, ["TT3HQ774N4.com.attayyibun.attayyibun"]);
    assert.deepEqual(detail.appIDs, [IOS_APP_ID]);
    assert.deepEqual(detail.components, [{ "/": "/requests" }, { "/": "/profiles/*" }]);
  });

  it("claims only the paths the app opens", () => {
    assert.deepEqual([...APP_LINK_PATHS], ["/requests", "/profiles/*"]);
  });
});

describe("middleware and /.well-known", () => {
  // Next compiles the matcher like this: the middleware runs only on a match.
  const matched = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

  for (const path of ["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]) {
    it(`never runs the middleware for ${path}`, () => {
      assert.equal(matched(path), false);
    });
  }

  it("still runs the middleware for pages", () => {
    assert.equal(matched("/requests"), true);
    assert.equal(matched("/profiles/abc"), true);
  });

  it("still gates the requests page the app link points at", () => {
    const res = middleware(new NextRequest("https://attayyibun.com/requests"));
    assert.equal(res.status, 307);
  });
});
