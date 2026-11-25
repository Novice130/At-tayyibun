import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safe-redirect";

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
