# Open issues — iOS launch — as of 2026-08-20

Supersedes `docs/open-issues-2026-08-19.md`. All eight review findings in
section 1 of that document are now fixed; what remains is deployment, manual
portal work, and device testing.

Verification state of this working tree: `nest build` ✓, `next build` ✓,
`flutter analyze` clean ✓, `flutter test` green ✓. `apps/api` has no jest specs
at all (`pnpm --filter api test` exits 1 with "No tests found") — pre-existing.

---

## 1. Fixed in this session (uncommitted working tree)

1. **pnpm-lock.yaml synced.** `corepack pnpm install` at the repo root picked up
   the hand-added `jose` and `tsx` in `apps/api/package.json`. Docker's
   `--frozen-lockfile` install will no longer fail.
2. **Apple revoke now selects the Apple account row.**
   `apps/api/src/modules/users/users.service.ts` filters on
   `providerId = 'apple'` as well as `userId`, so a user with Google linked no
   longer shadows the Apple refresh token (Guideline 5.1.1(v)).
3. **Blocked people disappear from browse immediately.**
   `apps/mobile/lib/screens/browse_screen.dart` watches `blockedAccountsProvider`
   and filters the locally held `_items` in `build`. `profile_detail_screen` and
   `requests_screen` invalidate that provider after a successful block, so the
   server-side exclusion no longer has to wait for a manual refresh.
4. **Block confirmation toast shows.** `profile_detail_screen._block` captures
   `ScaffoldMessenger.of(context)` before `context.pop()`; the messenger lives at
   the `MaterialApp` level and survives the pop, whereas `_toast`'s `mounted`
   check did not.
5. **Mobile signup has an avatar step.** `signup_screen.dart` is now two steps:
   details, then gender + avatar grid, with `image` passed to
   `AuthRepository.signUp`. Gender is asked only to select the preset set — the
   profile wizard still owns `profiles.gender`. The grid itself moved to
   `apps/mobile/lib/widgets/avatar_grid.dart`, shared with
   `avatar_picker_screen.dart` so both show the same tile, ring and check badge.
6. **Avatar URLs are absolute everywhere.** Migration
   `0002_blocks_reports_terms.sql` gained a trailing
   `UPDATE users SET image = 'https://attayyibun.com' || image WHERE image LIKE '/avatars/%'`,
   and `apps/web/src/app/signup/SignupForm.tsx` sends
   `toAbsoluteAvatar(formData.avatar)` to `signUp.email`. The `MALE_AVATARS` /
   `FEMALE_AVATARS` paths stay relative on purpose so `next/image` keeps serving
   them from the current origin in every environment; only the stored value is
   absolutised. Both web render sites already pass `unoptimized`, so no
   `remotePatterns` entry is needed.
7. **Typography actually uses the runtime platform.**
   `Typography.material2021(platform: defaultTargetPlatform)` in
   `apps/mobile/lib/core/theme.dart` (with the `foundation.dart` import) — the
   bare call defaults to `TargetPlatform.android`.
8. **`DEPLOYMENT_LESSONS.md`** gained entries 9–11: the Apple client-secret
   6-month `invalid_client` time-bomb and how to regenerate it, `corepack pnpm`
   plus the lockfile rule, and why drizzle migrations here are hand-written.

## 2. Deployment steps owed (unchanged)

1. Apply migration 0002 to production Neon by deploying the API — the migrator
   runs before server start and compares journal `when` values. Note 0002 now
   also rewrites existing relative `users.image` values.
2. Verify afterwards: tables `blocks`, `reports`, enum `ReportStatus`, column
   `users.terms_accepted_at`, and no row left matching `image LIKE '/avatars/%'`.
3. Deploy web + API containers together — both have changes.

## 3. Manual / portal items (cannot be done by an agent)

Unchanged from `open-issues-2026-08-19.md` section 3: A1 (Apple portal App ID,
Services ID, key, App Store Connect record), A2 (`corepack pnpm --filter api
apple:secret`, inject `APPLE_CLIENT_SECRET`, 5-month calendar reminder), A2b
(rotate the leaked Google web client secret — `docs/SECURITY-ROTATION.md`), A5
(Apple Private Email Relay domain registration), C2 (Google Cloud iOS OAuth
client, replace `PASTE_IOS_CLIENT_ID` in two spots in
`apps/mobile/ios/Runner/Info.plist`), B2-op (monitored report address + 24-hour
SLA in the review notes), E1–E4 (build ipa with the `--dart-define`, Transporter
upload, metadata, demo account, submit with manual release, bump `version:` in
`pubspec.yaml`).

## 4. Unverified / risk items

- Nothing has run on a **physical device**. Still owed: Apple sign-in first-run
  name capture, cookie persistence across a cold restart, Google sign-in on iOS,
  block/report, avatar change, delete account.
- better-auth `date` additionalField: signup passes an ISO string for
  `termsAcceptedAt` — confirm it persists on one real signup.
- better-auth 1.6.27 apple provider with `appBundleIdentifier` compiles but is
  untested end-to-end; it needs the A1/A2 secrets first.
- Web Danger Zone calls `api.delete('/users/me')` then POSTs `/auth/sign-out` —
  confirm the session actually clears.
- The new mobile signup avatar step has not been exercised against a live
  server; `signUp` accepts `image`, but a real sign-up should confirm
  `users.image` lands absolute and browse then prefers it over DiceBear.
- `apps/api` still has zero tests.
