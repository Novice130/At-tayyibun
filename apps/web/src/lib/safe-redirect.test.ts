import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath, socialCallbackPath } from "./safe-redirect";

describe("safeNextPath", () => {
  for (const good of ["/browse", "/requests/abc/contact", "/verify-phone?new=1", "/profile#photos"]) {
    it(`keeps ${good}`, () => assert.equal(safeNextPath(good), good));
  }

  const bad: Array<[string, string | null | undefined]> = [
    ["missing", null],
    ["undefined", undefined],
    ["empty", ""],
    ["protocol-relative", "//evil.example"],
    ["backslash host", "/\\evil.example"],
    ["double backslash", "\\\\evil.example"],
    ["absolute", "https://evil.example/"],
    ["javascript", "javascript:alert(1)"],
    ["no leading slash", "browse"],
    ["tab stripped by the URL parser", "/\t/evil.example"],
    ["newline stripped by the URL parser", "/\n/evil.example"],
    ["carriage return", "/\r/evil.example"],
    ["null byte", "/\u0000/evil.example"],
    ["delete char", "/\u007f/evil.example"],
    ["leading space", " //evil.example"],
    ["leading tab", "\t//evil.example"],
    ["dot segment normalising to //", "/.//evil.example"],
    ["parent segment normalising to //", "/..//evil.example"],
    ["credentials trick", "//user@evil.example"],
  ];
  for (const [name, value] of bad) {
    it(`rejects ${name}`, () => assert.equal(safeNextPath(value), null));
  }
});

describe("socialCallbackPath", () => {
  it("sends a plain sign-in to the phone gate", () => {
    assert.equal(socialCallbackPath(null), "/verify-phone");
  });

  it("carries the destination through the phone gate", () => {
    assert.equal(socialCallbackPath("/requests/abc"), "/verify-phone?next=%2Frequests%2Fabc");
  });

  it("skips the phone gate for account deletion", () => {
    assert.equal(socialCallbackPath("/delete-account"), "/delete-account");
  });

  it("drops an off-site destination", () => {
    assert.equal(socialCallbackPath("//evil.example"), "/verify-phone");
  });
});
