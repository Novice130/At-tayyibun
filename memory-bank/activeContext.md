# Active Context — 2026-08-26

## Status
- **Admin Single Concurrent Session**: Implemented in `apps/web/src/lib/auth.ts` (`databaseHooks.session.create.after`). When an admin logs in from any device/country, all other active sessions for that admin account are automatically revoked from the database.
- **Apple Sign-In**: Live and verified on production web (`https://attayyibun.com`) and iOS app.
- **Google Sign-In**: Fixed audience mismatch; using `659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com`.
- **iOS App & TestFlight**:
  - App ID: `6805307609`, Bundle ID: `com.attayyibun.attayyibun`, Team ID: `TT3HQ774N4`.
  - Build script: `apps/mobile/scripts/upload_to_testflight.sh`.
  - Latest build uploaded to TestFlight: **Build 6 (`0.1.3+6`)**.
  - New users signing in via Google/Apple/Phone without an avatar are automatically directed to the Brother/Sister avatar picker (`/profile/avatar?initial=true`) before opening `/browse`.
- **Admin 2FA**:
  - `admin@attayyibun.com` (Role: `SUPER_ADMIN`).
  - Supports Google Authenticator (TOTP), Email OTP, and Backup Codes on `/admin/security/challenge`.
- **Avatars**: 42 curated avatars (21 male, 21 female from `Images_New/`) served from `https://attayyibun.com/avatars/`.

## Key Commands
- TestFlight Upload: `./apps/mobile/scripts/upload_to_testflight.sh`
- Check TestFlight Builds: `node apps/mobile/scripts/check_build_status.js`
- Local Dev: `pnpm dev`


