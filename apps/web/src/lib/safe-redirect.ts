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
