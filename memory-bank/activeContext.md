# Active Context — 2026-08-26

## Status
- Published all commits to GitHub `origin/main` (`b5d6e1c`).
- Verified no sensitive secrets/keys are tracked in Git.
- Admin credentials updated in Neon database (`admin@attayyibun.com`) with Google Authenticator TOTP enabled.
- 2FA challenge page enhanced to support TOTP (Google Authenticator), Email OTP, and Backup Codes.
- Mandatory email verification bypassed; signup now routes straight to phone verification and profile wizard.
- iOS login and onboarding flow verified and recorded to `ios_login_flow.mp4` for App Store review.

## Last commits on `main`
- `b5d6e1c` — fix(auth): refine 2FA challenge page verification fallback types
- `e5b6f72` — fix(deploy): add alpine build deps to Dockerfile.web, enable TOTP 2FA, and streamline phone verification signup

## Open work / Notes
- Android Google Sign-In does NOT need a client secret (Android uses SHA-1 fingerprint and package name in Google Cloud Console; only Web OAuth clients use client secret).
- iOS App Store review video generated at `ios_login_flow.mp4`.

