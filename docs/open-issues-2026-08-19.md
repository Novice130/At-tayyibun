# Open issues — iOS launch — as of 2026-08-19

Written so a fresh session can resume without this chat. Commits:

- `1a75a6c` — security-hardening baseline (pre-iOS dirty tree, committed as-is)
- `243789f` — iOS launch plan implementation (Phases A–D + iOS target)

Verification state: `nest build` ✓, `next build` ✓, `flutter analyze` clean,
`flutter test` green, `flutter build ios --debug --simulator` succeeds. Icon
alpha confirmed absent (`sips` → hasAlpha: no).

---

## 1. Review findings — FIX FIRST (review of 243789f found these)

1. **pnpm-lock.yaml out of sync.** `apps/api/package.json` gained `jose` and
   `tsx` by hand-edit (direct `pnpm add` failed with
   `ERR_PNPM_INCLUDED_DEPS_CONFLICT`). CI/Docker `pnpm install
   --frozen-lockfile` will fail. Fix: run `corepack pnpm install` at repo
   root (pnpm is not on PATH; `corepack pnpm` works), commit the lockfile.
2. **Apple revoke grabs the wrong account row.** `users.service.ts`
   `revokeAppleTokenIfPresent` selects the first `account` row for the user —
   a Google row has no Apple refresh token, so the Apple token never gets
   revoked (Guideline 5.1.1(v) deletion-revoke failure). Add
   `providerId = 'apple'` to the where clause.
3. **Blocked person stays in browse until manual refresh.** `browse_screen`
   keeps its list in local state, not a provider. After a block from
   profile detail the plan requires the person to visibly disappear — they
   don't. Minimal fix: browse watches `blockedAccountsProvider` and filters
   `_items` client-side (server already excludes them on next fetch).
4. **Toast after block never shows.** `profile_detail._block` calls
   `context.pop()` then `_toast()` — the widget is unmounted by then, the
   snackbar is swallowed. Capture `ScaffoldMessenger.of(context)` before the
   pop (it lives at the MaterialApp level, survives the pop).
5. **Mobile signup has no avatar step.** Plan B4 item 5 explicitly asks for
   one "after gender is known" — every mobile account still falls back to
   the initial-letter placeholder. Mobile signup collects no gender either;
   add a gender selector + avatar grid step (web parity), pass `image` to
   `signUp` (repo already supports it).
6. **Relative avatar URLs in existing data.** Web signup stores
   `/avatars/male/male-1.jpg` (relative) in `users.image`; mobile
   `Image.network` needs absolute. Two parts: (a) append
   `UPDATE users SET image = 'https://attayyibun.com' || image WHERE image
   LIKE '/avatars/%';` to migration `0002_blocks_reports_terms.sql` (not
   yet applied anywhere, safe to edit), (b) make `MALE_AVATARS` /
   `FEMALE_AVATARS` in `apps/web/src/app/signup/SignupForm.tsx:12-13`
   absolute so new signups store absolute.
7. **Typography platform edit did nothing.** `Typography.material2021()`
   defaults `platform` to `TargetPlatform.android` — dropping the argument
   kept Android metrics. Use
   `Typography.material2021(platform: defaultTargetPlatform)` instead
   (`defaultTargetPlatform` from foundation, evaluated at runtime).
8. **No DEPLOYMENT_LESSONS entry.** Plan says the Apple client secret
   6-month expiry → silent `invalid_client` time-bomb belongs in
   DEPLOYMENT_LESSONS.md. Also worth noting there: `pnpm` not on PATH (use
   `corepack pnpm`).

## 2. Deployment steps owed

1. Apply migration 0002 to production Neon: deploy API (migrator runs
   before server start — it compares journal `when` values; 0002 >
   bootstrapped 0001, so it applies automatically). Or run locally with
   `DATABASE_URL` set.
2. Verify 0002 applied (tables `blocks`, `reports`, enum `ReportStatus`,
   column `users.terms_accepted_at`).
3. Deploy web + API containers together (both have changes).

## 3. Manual / portal items (cannot be done by an agent)

- **A1** Apple portal: App ID `com.attayyibun.attayyibun` + Sign in with
  Apple capability, Services ID `com.attayyibun.web` (return URL
  `https://attayyibun.com/auth/callback/apple`), Sign in with Apple key
  (.p8 — download once), App Store Connect app record.
- **A2** run `corepack pnpm --filter api apple:secret` with the portal
  values, inject `APPLE_CLIENT_SECRET` into both containers. Calendar
  reminder at 5 months.
- **A2b** rotate the leaked Google web client secret (deferred item, now
  due — see docs/SECURITY-ROTATION.md and open-issues-2026-08-10 B1).
- **A5** register Resend sending domain for Apple Private Email Relay
  (developer.apple.com → Sign in with Apple for Email Communication).
- **C2** Google Cloud Console: create the **iOS** OAuth client (bundle id
  `com.attayyibun.attayyibun`), replace `PASTE_IOS_CLIENT_ID` (2 spots) in
  `apps/mobile/ios/Runner/Info.plist`.
- **B2-op** point report notification email at an address that is actually
  monitored; state the 24-hour SLA in review notes.
- **E1–E4** `flutter build ipa --release
  --dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>`, Transporter
  upload, App Store Connect metadata + screenshots + demo account (see plan
  E3), submit with manual release. Bump `version:` in pubspec — iOS build
  numbers must strictly increase (`0.1.2+3` is consumed by Android).

## 4. Unverified / risk items

- better-auth `date` additionalField: signup passes an ISO string for
  `termsAcceptedAt` — confirm it persists (test one signup).
- better-auth 1.6.27 apple provider with `appBundleIdentifier` — compiles
  but untested end-to-end (needs A1/A2 secrets).
- Web Danger Zone calls `api.delete('/users/me')` then POSTs
  `/auth/sign-out` directly — confirm session clears.
- Device pass (plan Verification list): Apple sign-in, cookie persistence
  across cold restart, Google sign-in on iOS, block/report flow, avatar
  change, delete account. Simulator builds are green; nothing has run on a
  physical device.

## 5. Environment gotchas encountered

- Disk filled to 121 MB free mid-run; `flutter clean` freed ~2 GB.
  `flutter clean` also deletes Pods — rebuild re-runs `pod install`.
- `drizzle-kit generate` requires a TTY on this introspected schema —
  migrations are hand-written (0001, 0002 precedent). No 0002 snapshot was
  added; the runtime migrator only reads the journal + SQL.
- `flutter_launcher_icons` runs via `dart run flutter_launcher_icons`.
