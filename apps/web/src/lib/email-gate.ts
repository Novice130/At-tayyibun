/**
 * The onboarding gates (verified phone, then a real email) as pure logic, and
 * the client-side record of an email change that is waiting for its link.
 *
 * Why the record exists: changeEmail keeps verification on
 * (updateEmailWithoutVerification: false), so a phone-first member's address
 * stays the +<e164>@phone.attayyibun.invalid placeholder until they open the
 * link mailed to the new one. Better Auth keeps no server-side trace of that
 * request (the token is a signed JWT), and sends nothing at all when the
 * address belongs to another account. Without a note of our own, the gate
 * kept such a member at /profile/setup with no way forward.
 *
 * The record is UX state only. It never makes the placeholder count as a real
 * address: the API shares an email only when it is verified and not a
 * placeholder, and skips mail to placeholders.
 */

export type GatedUser = {
  id?: string;
  phoneNumberVerified?: boolean;
  isPhoneVerified?: boolean;
  phoneGateExempt?: boolean;
  emailIsPlaceholder?: boolean;
};

/** What this browser knows about a member's pending email change. */
export type PendingEmail = {
  /** The address the confirmation link was sent to. */
  email?: string;
  /** The saved profile was complete when last seen here. */
  profileComplete?: boolean;
};

// Pages each gate must not bounce away from, or the redirect loops. The phone
// gate has the shorter list on purpose: /profile/setup is where the email gate
// sends people, but a user with no verified phone cannot save anything there
// (the API refuses it), so they belong at /verify-phone first.
export const PHONE_GATE_EXEMPT = ['/verify-phone'];
export const EMAIL_GATE_EXEMPT = ['/verify-phone', '/profile/setup'];

const matches = (paths: string[], pathname: string) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function isPhoneVerified(user: GatedUser): boolean {
  return Boolean(user.phoneNumberVerified) || Boolean(user.isPhoneVerified) || Boolean(user.phoneGateExempt);
}

/**
 * A placeholder-email member who has asked for a real address and finished
 * their profile. They may use the app while the link is outstanding; the
 * banner keeps asking them to confirm.
 */
export function awaitingEmailConfirmation(user: GatedUser, pending: PendingEmail | null): boolean {
  return Boolean(
    user.emailIsPlaceholder && isPhoneVerified(user) && pending?.email && pending.profileComplete,
  );
}

/** Where the onboarding gates send this user, or null to stay. */
export function onboardingRedirect(
  user: GatedUser,
  pathname: string,
  pending: PendingEmail | null,
): '/verify-phone' | '/profile/setup' | null {
  if (!isPhoneVerified(user) && !matches(PHONE_GATE_EXEMPT, pathname)) return '/verify-phone';
  if (
    user.emailIsPlaceholder &&
    !awaitingEmailConfirmation(user, pending) &&
    !matches(EMAIL_GATE_EXEMPT, pathname)
  ) {
    return '/profile/setup';
  }
  return null;
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY_PREFIX = 'at-tayyibun:pending-email:';
export const PENDING_EMAIL_CHANGED = 'at-tayyibun:pending-email-changed';

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPendingEmail(userId: string | undefined, store = defaultStore()): PendingEmail | null {
  if (!userId || !store) return null;
  try {
    const raw = store.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { email, profileComplete } = parsed as Record<string, unknown>;
    return {
      ...(typeof email === 'string' && email ? { email } : {}),
      ...(profileComplete === true ? { profileComplete: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Merges into the stored record. */
export function writePendingEmail(
  userId: string | undefined,
  patch: PendingEmail,
  store = defaultStore(),
): void {
  if (!userId || !store) return;
  try {
    const next = { ...(readPendingEmail(userId, store) ?? {}), ...patch };
    store.setItem(KEY_PREFIX + userId, JSON.stringify(next));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_EMAIL_CHANGED));
}

export function clearPendingEmail(userId: string | undefined, store = defaultStore()): void {
  if (!userId || !store) return;
  try {
    store.removeItem(KEY_PREFIX + userId);
  } catch {
    /* nothing stored */
  }
}
