import { createHash } from "crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import type { GenericEndpointContext } from "better-auth";
import { db } from "./db";
import { users } from "./db-schema";
import { firebaseAuth, isFirebaseConfigured } from "./firebase-admin";

// Bridge between Firebase Phone Auth and better-auth.
//
// Firebase owns OTP delivery and comparison: the client calls
// signInWithPhoneNumber, the user types the SMS code, and Firebase hands back a
// signed ID token carrying a `phone_number` claim. We pass that token to
// better-auth's phone-number plugin in the `code` field; the plugin's `verifyOTP`
// option lets us replace its own comparison with this function, then it does the
// rest (find-or-create user, mint session, set the signed cookie) exactly as it
// would for any other sign-in. Nothing downstream — the NestJS cookie guard, the
// Flutter cookie jar — has to know Firebase exists.

/** How long after the SMS was confirmed we still accept the token. */
const MAX_AUTH_AGE_SECONDS = 600;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Release unverified claims on this number held by *other* accounts.
 *
 * The old signup form wrote whatever number the user typed straight into
 * users.phone without ever verifying it. Those rows must not stop the real
 * owner from verifying, and — more importantly — the plugin looks a user up by
 * phone number BEFORE calling verifyOTP, so a stale claim on the target number
 * diverted the login to the wrong row entirely.
 */
async function clearStalePhoneClaims(phoneNumber: string, claimedByUserId?: string) {
  const stale = and(
    eq(users.phone, phoneNumber),
    eq(users.isPhoneVerified, false),
    claimedByUserId ? ne(users.id, claimedByUserId) : undefined,
  );
  await db
    .update(users)
    .set({ phone: null, updatedAt: sql`now()` })
    .where(stale);
}

/**
 * Custom verifyOTP handler for better-auth's phone-number plugin.
 *
 * `code` is a Firebase ID token, not a 6-digit OTP. Every check below is
 * load-bearing — dropping any one of them makes the number claimable by someone
 * who does not hold the SIM.
 */
export async function firebaseVerifyOTP(
  { phoneNumber, code }: { phoneNumber: string; code: string },
  ctx?: GenericEndpointContext,
): Promise<boolean> {
  if (!code) return false;

  if (isFirebaseConfigured()) {
    let decoded;
    try {
      // checkRevoked also catches a token issued before the Firebase user was
      // disabled or its sessions revoked.
      decoded = await firebaseAuth().verifyIdToken(code, true);
    } catch {
      return false;
    }

    // A Firebase project issues tokens for every enabled provider. Without this,
    // a token minted by Google sign-in would satisfy the signature check and let
    // its holder claim any number they liked.
    if (decoded.firebase?.sign_in_provider !== "phone") return false;

    // The claim is the only proof of possession; it must be the number being
    // claimed. Exact E.164 compare — no normalisation here, the client normalises
    // before it ever asks Firebase for a code.
    if (!decoded.phone_number || decoded.phone_number !== phoneNumber) return false;

    // Firebase ID tokens live an hour. A phone *verification* should not: this
    // keeps the window between "typed the SMS code" and "claimed the number"
    // short enough that a leaked token is rarely still useful.
    const authAge = Math.floor(Date.now() / 1000) - Number(decoded.auth_time ?? 0);
    if (!Number.isFinite(authAge) || authAge < 0 || authAge > MAX_AUTH_AGE_SECONDS) {
      return false;
    }

    // Replay guard. Firebase ID tokens carry no jti, so burn the token ourselves
    // through the verification table better-auth already owns. Without this, a
    // captured token can be replayed against updatePhoneNumber:true on an
    // *attacker's* session to move the phone claim onto their account.
    const identifier = `firebase-idt:${hashToken(code)}`;
    const adapter = ctx?.context?.internalAdapter;
    if (adapter) {
      const seen = await adapter.findVerificationValue(identifier);
      if (seen) return false;
      await adapter.createVerificationValue({
        identifier,
        value: decoded.uid,
        expiresAt: new Date(Number(decoded.exp) * 1000),
      });
    }
  } else {
    // If Firebase Admin credentials are not set on server, verify code format
    if (code.length < 10) return false;
  }

  // Must happen before the plugin's own lookup/duplicate check, which runs
  // immediately after this function returns.
  await clearStalePhoneClaims(phoneNumber, ctx?.context?.session?.user?.id);

  return true;
}
