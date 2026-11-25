import { createHash } from 'crypto';

export interface DisplayNameInput {
  firstName?: string | null;
  hideName?: boolean | null;
  gender?: string | null;
  publicId?: string | null;
}

/** Uppercases the first letter of each space-separated word; the rest stays as typed. */
function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Title Case each word, hyphen parts included: "st. louis" -> "St. Louis",
 * "NEW YORK" -> "New York", "winston-salem" -> "Winston-Salem". A word typed
 * in deliberate mixed case ("McLean") keeps its inner capitals.
 */
function titleCase(value: string): string {
  const part = (p: string) => {
    if (!p) return p;
    const rest = p.slice(1);
    const mixed = rest !== rest.toLowerCase() && rest !== rest.toUpperCase();
    return p.charAt(0).toUpperCase() + (mixed ? rest : rest.toLowerCase());
  };
  return value
    .trim()
    .split(/\s+/)
    .map((w) => w.split('-').map(part).join('-'))
    .join(' ');
}

/**
 * A stable 4-digit number (1000-9999) for a member, derived from their
 * publicId so the same member always gets the same label. Not reversible to
 * the publicId in any useful way, and never the publicId itself.
 */
export function memberNumber(publicId: string | null | undefined): number {
  const digest = createHash('sha256').update(String(publicId ?? '')).digest();
  return 1000 + (digest.readUInt32BE(0) % 9000);
}

/**
 * The name to show for a member on cards and lists. Never returns the
 * publicId: a hidden or empty name falls back to "Sister/Brother/Member NNNN".
 */
export function displayNameFor({ firstName, hideName, gender, publicId }: DisplayNameInput): string {
  const name = typeof firstName === 'string' ? firstName.trim() : '';
  if (!hideName && name) return capitalizeWords(name);
  const label = gender === 'FEMALE' ? 'Sister' : gender === 'MALE' ? 'Brother' : 'Member';
  return `${label} ${memberNumber(publicId)}`;
}

/** City in Title Case with whitespace collapsed; empty becomes null. */
export function formatCity(city: string | null | undefined): string | null {
  if (typeof city !== 'string') return city ?? null;
  const v = titleCase(city);
  return v || null;
}

/** Two-letter state codes uppercased ("va" -> "VA"), anything else Title Case; empty becomes null. */
export function formatState(state: string | null | undefined): string | null {
  if (typeof state !== 'string') return state ?? null;
  const v = state.trim().replace(/\s+/g, ' ');
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return titleCase(v);
}

export function formatPlace(
  city: string | null | undefined,
  state: string | null | undefined,
): { city: string | null; state: string | null } {
  return { city: formatCity(city), state: formatState(state) };
}
