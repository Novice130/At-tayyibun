# Open issues — iOS launch — as of 2026-08-20

Supersedes `docs/open-issues-2026-08-19.md`. All eight review findings in
section 1 of that document are now fixed; what remains is deployment, manual
portal work, and device testing.

Verification state: `nest build` ✓, `next build` ✓, `flutter analyze` clean ✓,
`flutter test` green ✓. `apps/api` now has 37 passing jest specs across three
files (see section 5) — the "no tests found" state noted earlier in this
document is resolved.

**Git state:** committed as `005feeb` and **pushed to `origin/main`** on
2026-08-20. That push also carried up three previously unpushed local commits:
`1a75a6c` (security-hardening baseline), `243789f` (iOS launch plan
implementation) and `11db179` (the 08-19 handoff). `.commandcode/taste/taste.md`
is deliberately left unstaged — unrelated pre-existing edit.

⚠️ **Consequence of that push:** if Dokploy autoDeploy is on for the API, the
deploy runs the migrator, which applies `0002_blocks_reports_terms.sql` to the
production Neon database — creating `blocks`, `reports`, the `ReportStatus`
enum and `users.terms_accepted_at`, **and** running
`UPDATE users SET image = 'https://attayyibun.com' || image WHERE image LIKE '/avatars/%'`
against live rows. Intended, but it is a one-way data rewrite. Web and API
should be deployed together. Verify per section 2 before assuming it ran.

**Pushing from this machine:** the `origin` remote is HTTPS and fails with
`Password authentication is not supported for Git operations`; `gh` is not
installed. SSH works (`git@github.com` authenticates as `Novice130`), so either
push by URL (`git push git@github.com:Novice130/At-tayyibun.git main`) or fix it
permanently with
`git remote set-url origin git@github.com:Novice130/At-tayyibun.git`.

---

## 1. Fixed in this session (commit `005feeb`)

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

Section 5 below records what a source read could and could not settle about
these.

---

## 5. Follow-up session — 2026-08-20 (later)

### 5a. Plan checklist reconciled

`docs/ios-launch-plan.md` had every task box unticked even though commit
`243789f` implemented most of them. Each A/B/C/D item was checked against the
source and the checklist now carries a status, a file reference and, where the
code diverges from the plan, a note. A new "Deviations from the plan as written"
section at the end of that document records the four real differences.

The one that matters for review: **Sign in with Apple is on the login screen
only**, not on signup as the plan specified. It is still Guideline 4.8-compliant
— the signup screen offers no third-party sign-in at all, so there is nothing
for Apple to be missing next to — but a user who wants Apple has to back out to
the login screen to find it. Worth closing before submission.

The one that is still a hard blocker: **C2 `PASTE_IOS_CLIENT_ID`** is still a
literal placeholder at `apps/mobile/ios/Runner/Info.plist` lines 61 and 69.
Google sign-in on iOS cannot work until the iOS OAuth client exists.

### 5b. Section 4 items, as far as a source read can settle them

Traced in the code. None of this replaces a device or production run — it only
narrows what is left to find there.

- **18+ enforcement** is real on all three surfaces:
  `profiles.service.ts:255` (server, throws `BadRequestException`),
  `profile/setup/page.tsx:264` (web), and `edit_profile_screen.dart:156` plus a
  `lastDate: DateTime(now.year - 18, ...)` cap on the picker at line 355.
  Now covered by tests, including the day-before-18th-birthday boundary.
- **Apple revoke selects the Apple row.** Confirmed at `users.service.ts:70-74`
  and now pinned by a test asserting that a Google-only user produces no revoke
  call at all, rather than one with an empty token.
- **Deletion survives Apple being unreachable.** `revokeAppleTokenIfPresent`
  swallows both a non-OK response and a thrown request; two tests assert the
  account is still hard-deleted in each case. This is the behaviour Apple's
  reviewer tests, so it is worth having locked down.
- **`termsAcceptedAt` is declared** as `{ type: "date", required: false, input:
  true }` at `apps/web/src/lib/auth.ts:357`, and mobile sends it from
  `signup_screen.dart:113`. Whether better-auth's `date` field accepts the ISO
  string mobile sends is a runtime question the source cannot answer — **still
  owed on one real signup**.
- **Web Danger Zone** lives in `apps/web/src/app/profile/page.tsx`. The
  call sequence is as described. Whether the session cookie actually clears is
  **still owed on a real run**.
- **Avatar absolutisation** — the API prefers `users.image` when non-empty
  (`profiles.service.ts:113` and `:160`) and `ProfileAvatar` picks its decoder
  off the extension (`profile_avatar.dart:33`), so a stored `.jpg` renders. What
  is unverified is the migration's rewrite against live rows.

### 5c. Code changes in this session

1. **`apps/api` test suite created.** 37 tests, `pnpm --filter api test` green:
   - `moderation.service.spec.ts` — self-block and self-report rejection, unknown
     public id, the 10/day report limit at both the 10th and 11th report, detail
     truncation at 500 chars, report survival when the notification email fails,
     double-resolve rejection, and `hardDeleteUser`'s object-storage cleanup and
     restrict-FK delete order.
   - `users.service.spec.ts` — profile flattening, lower-cased email lookup, and
     the five Apple-revoke paths (unconfigured, refresh token, access-token
     fallback, no Apple row, Apple failing).
   - `profiles.service.spec.ts` — the 18+ gate including boundaries, and the
     empty-string-clears-the-field behaviour.
   - `src/test/drizzle-mock.ts` — a Proxy-based thenable that stands in for a
     Drizzle query builder, so the specs do not encode the exact call chain.

   The age-gate tests were mutation-checked: relaxing `< 18` to `< 0` in the
   service turns two of them red.

2. **App Store badge wired but dormant.** `apps/web/src/app/download/page.tsx`
   gained an `APP_STORE_URL` constant, currently `null`. While it is null the
   page is exactly what it was. Set it to the listing URL after approval and the
   iOS card, the page title and the removal of the "no iPhone app yet" note all
   follow from that one edit. The Apple mark is an inline SVG — lucide's `Apple`
   icon is a piece of fruit.

3. **`pubspec.yaml` bumped to `0.1.3+4`.** iOS rejects an upload whose build
   number is not strictly greater than every previous one, and `0.1.2+3` is
   already spent on Android. **Note the consequence:** the download page's
   `APK_VERSION` still reads `0.1.2 (build 3)`, which is correct — it describes
   the APK committed at `apps/web/public/downloads/`, a different artifact from
   the pubspec version. The comment above those constants now says so.

Verification after these changes: `pnpm --filter api test` 37/37 ✓,
`next build` ✓ (26/26 pages), `flutter analyze` clean ✓.

### 5d. Still outstanding

Unchanged: everything in section 2 (deployment), section 3 (manual/portal), and
the device-testing list at the top of section 4. Added by this session: the
Sign in with Apple button on the signup screen, if that gap is to be closed.
