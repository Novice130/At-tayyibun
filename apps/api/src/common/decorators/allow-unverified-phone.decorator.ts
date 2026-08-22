import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_PHONE_KEY = 'allowUnverifiedPhone';

/**
 * Let a route run for a signed-in user who has not verified a phone number yet.
 *
 * Every other authenticated route is refused until the phone is verified, which
 * is what actually enforces one-account-per-number — the client-side redirect is
 * only UX. Reserve this for the handful of endpoints the verification screen
 * itself needs (reading your own session, signing out, deleting the account);
 * anything that creates or reads matrimonial data must stay behind the gate.
 *
 * Usage: @AllowUnverifiedPhone()
 */
export const AllowUnverifiedPhone = () =>
  SetMetadata(ALLOW_UNVERIFIED_PHONE_KEY, true);
