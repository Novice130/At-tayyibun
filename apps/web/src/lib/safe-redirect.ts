const PARSE_BASE = "https://same-origin.invalid";

/**
 * The same-site path to go to after sign-in, or null if `next` could leave the
 * site. Parses with the URL parser, as the browser will, instead of pattern
 * matching the string: browsers drop tabs and newlines, treat a backslash as a
 * slash, and resolve "/.//host" to "//host", all of which turn an innocent-looking
 * path into a link to another host.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;

  let parsed: URL;
  try {
    parsed = new URL(next, PARSE_BASE);
  } catch {
    return null;
  }
  if (parsed.origin !== PARSE_BASE) return null;
  if (parsed.pathname.startsWith("//")) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Pages a signed-in account may open before it has verified a phone number. */
const PHONE_FREE_PATHS = ["/delete-account"];

/**
 * Where a Google or Apple sign-in should land, given the login page's `next`.
 * Normally the phone gate, which forwards `next` once the phone is verified.
 * The account deletion page needs no phone and is reached directly: an account
 * that never verified a phone must still be able to delete itself.
 */
export function socialCallbackPath(next: string | null | undefined): string {
  const safe = safeNextPath(next);
  if (!safe) return "/verify-phone";
  if (PHONE_FREE_PATHS.includes(new URL(safe, PARSE_BASE).pathname)) return safe;
  return `/verify-phone?next=${encodeURIComponent(safe)}`;
}
