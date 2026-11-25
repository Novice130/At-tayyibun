/**
 * Display formatting for member data. The API already Title Cases city/state
 * and sends a `displayName`; these helpers keep older API responses and old
 * stored data ("lorton, va", raw first names) looking the same.
 */

/**
 * Title Case one word, hyphen parts included: "winston-salem" -> "Winston-Salem",
 * "NEW" -> "New". A word typed in deliberate mixed case ("McLean") keeps its
 * inner capitals. Mirrors the API's formatter.
 */
function titleCaseWord(word: string): string {
  return word
    .split('-')
    .map((p) => {
      if (!p) return p;
      const rest = p.slice(1);
      const mixed = rest !== rest.toLowerCase() && rest !== rest.toUpperCase();
      return p.charAt(0).toUpperCase() + (mixed ? rest : rest.toLowerCase());
    })
    .join('-');
}

function titleCase(value: string): string {
  return value.trim().split(/\s+/).map(titleCaseWord).join(' ');
}

/** City in Title Case with whitespace collapsed; empty becomes null. */
export function formatCity(city: string | null | undefined): string | null {
  if (typeof city !== 'string') return null;
  return titleCase(city) || null;
}

/** Two-letter state codes uppercased ("va" -> "VA"), anything else Title Case; empty becomes null. */
export function formatState(state: string | null | undefined): string | null {
  if (typeof state !== 'string') return null;
  const v = state.trim().replace(/\s+/g, ' ');
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return titleCase(v);
}

/** "lorton", "va" -> "Lorton, VA". Either part may be missing; both missing gives null. */
export function formatPlace(
  city: string | null | undefined,
  state: string | null | undefined,
): string | null {
  const parts = [formatCity(city), formatState(state)].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** The name fields a member object may carry, from the current or an older API. */
export interface MemberNameFields {
  displayName?: string | null;
  firstName?: string | null;
}

/**
 * The name to show for a member. Prefers the API's `displayName` (first name or
 * an alias like "Sister 4821"), then `firstName` for older API responses, then
 * "Member". Never falls back to the publicId.
 */
export function memberDisplayName(member: MemberNameFields | null | undefined): string {
  const pick = (v: string | null | undefined) => (typeof v === 'string' ? v.trim() : '');
  return pick(member?.displayName) || pick(member?.firstName) || 'Member';
}
