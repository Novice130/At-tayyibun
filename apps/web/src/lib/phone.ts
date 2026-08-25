// Phone-number normalisation, shared by every surface that talks to Firebase.
//
// Firebase and better-auth both want strict E.164 (+<country><number>). Users
// type whatever they like, so normalise once, here, and never anywhere else —
// two normalisers that disagree mean a number verified under one spelling and
// stored under another, which quietly breaks the one-phone-one-account rule.

/** Fallback country dialling code for input typed without one. */
export const DEFAULT_COUNTRY_CODE = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || '+1';

/**
 * Normalise free-typed input to E.164, or null if it cannot be.
 *
 * 15 digits is the E.164 maximum and also keeps the result inside
 * users.phone's varchar(20). Without that upper bound a pasted number with an
 * extension reached Postgres as-is and came back as an opaque 500: "value too
 * long for type character varying(20)".
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Already international.
  if (trimmed.startsWith('+')) {
    return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
  }

  // 00 is the other way people write the international prefix.
  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    return rest.length >= 7 && rest.length <= 15 ? `+${rest}` : null;
  }

  const cc = DEFAULT_COUNTRY_CODE.replace(/\D/g, '');

  // National format with a trunk prefix, e.g. 03001234567 -> +923001234567.
  if (digits.startsWith('0')) {
    const national = digits.slice(1);
    const joined = `${cc}${national}`;
    return joined.length >= 7 && joined.length <= 15 ? `+${joined}` : null;
  }

  // Bare national number, or a full international number typed without the +.
  if (digits.startsWith(cc) && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }
  const joined = `${cc}${digits}`;
  return joined.length >= 7 && joined.length <= 15 ? `+${joined}` : null;
}

/** Display form for confirmation screens: keep it recognisable, not pretty. */
export function formatE164(value: string): string {
  return value;
}
