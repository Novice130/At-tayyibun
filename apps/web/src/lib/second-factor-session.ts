// Records on each session whether a second factor was passed to create it.
//
// Better Auth runs its 2FA challenge only on /sign-in/email, /sign-in/username
// and /sign-in/phone-number. /phone-number/verify, the Google and Apple
// callbacks and email-link sign-in all mint a full session without one, and
// nothing on the session row says which route made it. The API's RolesGuard
// reads this stamp to keep those sessions off admin routes.
//
// This is an allowlist, so a route added by a future Better Auth version is
// refused by default. Refusal costs an admin a fresh sign-in, never access.

const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-otp",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

export async function provedSecondFactor(
  path: string | undefined,
  userId: string,
  isEnrolled: (userId: string) => Promise<boolean>,
): Promise<boolean> {
  if (!path) return false;
  if (SECOND_FACTOR_PATHS.has(path)) return true;
  // For an enrolled user the plugin deletes this session and issues a challenge,
  // unless the device holds a trust cookie from an earlier verified sign-in.
  // Either way the stamp is only ever seen on a session that passed.
  if (path !== "/sign-in/email") return false;
  try {
    return await isEnrolled(userId);
  } catch (err) {
    console.error("[auth] could not read 2FA enrolment; session left unverified:", err);
    return false;
  }
}

export function secondFactorSessionHook(isEnrolled: (userId: string) => Promise<boolean>) {
  return async <S extends { userId: string }>(session: S, ctx: { path?: string } | null | undefined) => ({
    data: {
      ...session,
      twoFactorVerified: await provedSecondFactor(ctx?.path, session.userId, isEnrolled),
    },
  });
}
