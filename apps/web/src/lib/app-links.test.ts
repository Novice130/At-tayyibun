import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { GET as getAssetLinks } from "../app/.well-known/assetlinks.json/route";
import { GET as getAasa } from "../app/.well-known/apple-app-site-association/route";
import { ANDROID_PACKAGE_NAME, APP_LINK_PATHS, IOS_APP_ID } from "./app-links";

describe("app link verification files", () => {
  it("serves assetlinks.json as JSON for the Android package", async () => {
    const res = getAssetLinks();
    assert.equal(res.headers.get("content-type"), "application/json");
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.deepEqual(body[0].relation, ["delegate_permission/common.handle_all_urls"]);
    assert.equal(body[0].target.namespace, "android_app");
    assert.equal(body[0].target.package_name, "com.attayyibun.at_tayyibun");
    assert.equal(body[0].target.package_name, ANDROID_PACKAGE_NAME);
    assert.ok(body[0].target.sha256_cert_fingerprints.length > 0);
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
  const request = (url: string) => new NextRequest(url);

  for (const path of ["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]) {
    it(`passes ${path} straight through`, () => {
      const res = middleware(request(`https://attayyibun.com${path}`));
      assert.equal(res.headers.get("x-middleware-next"), "1");
    });

    it(`does not redirect ${path} on www`, () => {
      const res = middleware(
        new NextRequest(`https://www.attayyibun.com${path}`, { headers: { host: "www.attayyibun.com" } }),
      );
      assert.equal(res.headers.get("x-middleware-next"), "1");
      assert.equal(res.headers.get("location"), null);
    });
  }

  it("still gates the requests page the app link points at", () => {
    const res = middleware(request("https://attayyibun.com/requests"));
    assert.equal(res.status, 307);
  });
});
