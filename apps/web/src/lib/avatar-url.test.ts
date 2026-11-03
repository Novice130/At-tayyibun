import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertImageWritable, imageForNewUser, isPresetAvatar } from "./avatar-url";

const ORIGINS = ["https://attayyibun.com", "https://www.attayyibun.com"];
const PRESET = "https://attayyibun.com/avatars/female/female-21.jpg";
const GOOGLE = "https://lh3.googleusercontent.com/a/photo=s96-c";

describe("isPresetAvatar", () => {
  for (const good of [PRESET, "/avatars/male/male-1.jpg", "https://www.attayyibun.com/avatars/male/male-10.jpg"]) {
    it(`accepts ${good}`, () => assert.equal(isPresetAvatar(good, ORIGINS), true));
  }

  for (const bad of [
    "https://evil.example/avatars/male/male-1.jpg",
    "//evil.example/avatars/male/male-1.jpg",
    "https://attayyibun.com.evil.example/avatars/male/male-1.jpg",
    "https://user@evil.example/avatars/male/male-1.jpg",
    "http://attayyibun.com/avatars/male/male-1.jpg",
    "/avatars/male/male-22.jpg",
    "/avatars/male/male-0.jpg",
    "/avatars/male/female-1.jpg",
    "/avatars/other/other-1.jpg",
    "/avatars/male/../../secret.jpg",
    "/avatars/male/male-1.jpg?track=1",
    "/avatars/male/male-1.jpg#x",
    "https://attayyibun.com/avatars/male/male-1.jpg?x=1",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "/avatars/male/male-1.jpg\n",
    GOOGLE,
  ]) {
    it(`rejects ${JSON.stringify(bad)}`, () => assert.equal(isPresetAvatar(bad, ORIGINS), false));
  }
});

describe("assertImageWritable", () => {
  it("rejects an outside URL from /update-user", () => {
    assert.throws(() => assertImageWritable("https://evil.example/x.png", "/update-user", ORIGINS));
  });
  it("accepts a preset and clearing the image", () => {
    assertImageWritable(PRESET, "/update-user", ORIGINS);
    assertImageWritable(null, "/update-user", ORIGINS);
    assertImageWritable("", "/update-user", ORIGINS);
    assertImageWritable(undefined, "/update-user", ORIGINS);
  });
  it("leaves a provider's own photo alone on its callback", () => {
    assertImageWritable(GOOGLE, "/callback/:id", ORIGINS);
  });
});

describe("imageForNewUser", () => {
  it("keeps the Google or Apple photo on social sign-up", () => {
    assert.equal(imageForNewUser(GOOGLE, "/callback/:id", ORIGINS), GOOGLE);
    assert.equal(imageForNewUser(GOOGLE, "/sign-in/social", ORIGINS), GOOGLE);
  });
  it("keeps a preset on email sign-up", () => {
    assert.equal(imageForNewUser(PRESET, "/sign-up/email", ORIGINS), PRESET);
  });
  // Dropped rather than refused: an error here would appear only for addresses
  // that are not registered yet, which brings back the enumeration signal.
  it("drops an outside URL on email sign-up", () => {
    assert.equal(imageForNewUser("https://evil.example/x.png", "/sign-up/email", ORIGINS), null);
  });
  it("drops an outside URL when the path is unknown", () => {
    assert.equal(imageForNewUser("https://evil.example/x.png", undefined, ORIGINS), null);
  });
});
