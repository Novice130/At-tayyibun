import { APIError } from "better-auth";

const PRESET_PATH = /^\/avatars\/(male|female)\/\1-([1-9]|1\d|2[01])\.jpg$/;

/**
 * True for one of the 21-per-gender illustrated avatars in public/avatars, as a
 * path or as an absolute URL on one of our own origins. users.image is rendered
 * in other members' browsers, so an outside URL would let a member log the
 * address of everyone who views them.
 */
export function isPresetAvatar(value: string, allowedOrigins: readonly string[]): boolean {
  if (value.startsWith("/")) return PRESET_PATH.test(value);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (
    allowedOrigins.includes(parsed.origin) &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash &&
    PRESET_PATH.test(parsed.pathname) &&
    // The parser normalises "..", so compare against what was actually sent.
    value === `${parsed.origin}${parsed.pathname}`
  );
}

/**
 * Google and Apple sign-in store the provider's own photo on the new user. That
 * value comes from the provider rather than the request, and clients already
 * treat it as "no avatar chosen yet", so it stays allowed on these paths only.
 */
function isProviderPath(path: string | undefined): boolean {
  return !!path && (path.startsWith("/callback/") || path === "/sign-in/social");
}

/** The value to store on a new user. Never throws: see the test for why. */
export function imageForNewUser(
  image: string | null | undefined,
  path: string | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (!image) return null;
  if (isProviderPath(path) || isPresetAvatar(image, allowedOrigins)) return image;
  return null;
}

/** Refuses a write to an existing user's image that is not a preset. */
export function assertImageWritable(
  image: string | null | undefined,
  path: string | undefined,
  allowedOrigins: readonly string[],
): void {
  if (!image || isProviderPath(path) || isPresetAvatar(image, allowedOrigins)) return;
  throw new APIError("BAD_REQUEST", { message: "Please choose one of the provided avatars." });
}
