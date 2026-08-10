# Session handoff — 2026-08-10

Covers two pieces of work: fixing seven client-reported bugs in the web/API, and
building a Flutter Android client distributed as a signed APK on Cloudflare R2.

Branch: **`fix/client-reports-and-android-app`** (3 commits, branched off `main`).

> **Pushed and merged to `main` on 2026-08-10**, which triggered the Dokploy
> deploy. Migration `0001` was applied to production first. See
> [Outstanding actions](#outstanding-actions) for what is still open.

---

## 1. Client-reported bugs — all seven were real

Commit `082efe8` (36 files).

| Report | Root cause | Fix |
|---|---|---|
| No badge on Requests tab | No badge existed anywhere; feedback was `window.alert()` | Pending-incoming count badge (desktop + mobile nav) via `useIncomingRequestCount()`; sonner toasts replace every `alert()` |
| Home page shows when logged in | `/` was a static server component, no session check, no `middleware.ts`; `signUp.email` sent no `callbackURL` so better-auth dropped verified users there | `/` resolves the session server-side and redirects to `/browse`; signup passes `callbackURL: '/profile/setup'` |
| "Saved the form, it saved nothing" | **It always saved.** `profile/page.tsx` read `aboutMe`/`occupation`; API returns `bio`/`biodata`. Wizard never re-hydrated `lastName`, `bio`, or any of 12 biodata fields; nothing rendered them | Interface corrected, all biodata rendered, wizard re-hydrates every field |
| Why is there a Messages tab | 30-line stub, no auth guard, no backend (messaging API unbuilt) | Removed page + nav link |
| Login needs two attempts | better-auth resolves `signIn.email` then flips its session signal on a **10 ms timer**; `router.push` fired first, destination read a stale `null` and bounced to `/login` | `LoginForm` awaits `getSession()`; new `useRequireSession()` re-verifies with the server before redirecting, replacing the guard copy-pasted across 6 pages. Also handles `twoFactorRedirect`, which was racing the 2FA plugin's own navigation |
| Stuck forever on a dead profile | No cancel endpoint existed anywhere; no expiry job runs; `PENDING`→`EXPIRED` only fires if the *target* responds. Browse also locked every other card non-clickable | `DELETE /api/requests/:id` (owner-only, PENDING-only, hard-delete + audit). Browsing unlocked — a pending request now only disables the send button |
| "Most likely sending over email" | Profile save writes to Postgres. But `SignupForm` discarded `phone` + all guardian fields entirely | `phone` persisted via a better-auth `additionalField`; guardian data rides the profile seed |

### Latent 500 fixed at the same time

`info_requests_requester_id_status_key` was unique on `(requester_id, status)` but
**not partial**, so a requester could hold only one row per status for their whole
lifetime. Declining a user's *second* request raised a Postgres unique violation on
the `UPDATE ... SET status='DENIED'`, surfacing as an unhandled 500 with the
notification email and audit log skipped.

Migration `apps/api/drizzle/0001_partial_pending_request_index.sql` drops it and
creates a partial unique index on `(requester_id) WHERE status = 'PENDING'`. It
expires stale/duplicate PENDING rows first so it applies cleanly to existing data.

**This migration has not been run against any database yet.**

### Other changes worth knowing

- Global `short` rate limit raised **3/s → 20/s per IP** (`apps/api/src/app.module.ts`).
  `/browse` alone issues three parallel calls, so normal navigation could 429 itself.
  Per-endpoint limits unchanged (`POST /api/requests` is still 10/hour).
- `emailVerification.sendOnSignIn: true` — the login screen promised a resent
  verification link that was never actually sent.
- `publicFields` now merges instead of being clobbered on every partial PUT.
- `getMyProfile` returns the owner's real `city` (`hideLocation` is about what
  *others* see; masking it broke the edit wizard and rendered `, TX`).
- Field guards changed from truthiness to `!== undefined` so a user can clear a field.
- Mobile layout pass: requests rows (~18 px of usable text at 375 px), admin sidebar
  drawer, unscrollable users table, 2FA inputs overflowing the viewport, modal height
  caps, touch targets, explicit `viewport` export.

---

## 1b. The lockfile produced a build that could not deploy

Separate from the client reports, and the most urgent thing found this session.

`better-auth` resolves to **1.5.6** (`apps/web/package.json` says `^1.1.13`). It
declares `peerDependencies: { zod: ^4.0.0 }` and calls the v4-only `z.email()`.
`apps/web` pinned `zod: ^3.24.1`, so pnpm satisfied both by nesting zod 3.25.76
under `apps/web`, and webpack handed that copy to better-auth's modules.

Result: `export 'email' was not found in 'zod'` — and because the navbar imports
the auth client, **every page failed to compile**. `next build` could not
succeed from the committed lockfile, so the next Docker deploy would have failed
regardless of what was merged.

Fixed by moving the declared range to `^4.3.6` (commit `698eb2d`). `apps/web`
has zero direct zod imports — and `react-hook-form` / `@hookform/resolvers` are
declared but entirely unused — so there is no application-code impact. The
lockfile diff is 14 lines and retains every platform's SWC binaries (12 linux,
6 darwin, 6 win32), so Linux Docker builds are unaffected.

`next build` now completes; all 22 routes compile.

**Two things I initially reported here were wrong and are corrected for the
record:** there is no React 18/19 duplication (root is cleanly 19.0.0; the
`react@18.3.1` strings in `.pnpm` directory names are pnpm's peer-suffix naming,
not installed copies), and an observed `useReducer` null error was test
contamination — several dev-server restarts silently hit `EADDRINUSE` and were
serving a stale process. Only the zod conflict was real.

---

## 1c. Mobile menu was rendering transparent

The client reported the mobile menu "running over the home page". Two
independent causes, both fixed in `1c093e1`:

1. `bg-surface-secondary` is not a real class — it exists in neither
   `globals.css` (which defines `.bg-surface` / `.bg-surface-hover`) nor
   `tailwind.config.ts`. The panel therefore had **no background at all**. The
   same dead class was also making the desktop user dropdown and the admin 2FA
   modal transparent.
2. The dim backdrop was nested inside `<nav>`, which carries the `glass` class.
   `backdrop-filter` makes an element a containing block for fixed-position
   descendants, so `fixed inset-0` was clipped to the navbar's own box and only
   dimmed the top strip.

The overlay now renders as a sibling of `<nav>`, every affected surface sets its
colour explicitly from the CSS custom properties, and the panel height is capped
so a long menu scrolls.

Verified in a real browser (Playwright, 390×844): panel background
`rgb(255,255,255)`, border `rgb(232,228,221)`, the element painted inside the
panel is a menu link rather than hero text, and no horizontal overflow.

---

## 1d. Google Sign-In (web + Android)

Commit `5f7d8c9`.

**Web** uses the standard redirect flow via `signIn.social`. The previously dead
Google button on the login screen is wired up; the Facebook button was removed
because it had no handler and no configured provider.

**Android deliberately does not use the redirect flow.** The app authenticates
with a cookie in its own jar, so a redirect completed in a Custom Tab would set
the cookie on the browser instead. It uses Google's native SDK to obtain an ID
token and posts it to `/auth/sign-in/social`, which returns the session cookie
straight to the app.

**The critical detail:** the ID token must be minted with the **web** client id
as `serverClientId`. better-auth verifies `audience: options.clientId` — a
single value — so a token issued for the Android client id is always rejected.
The Android client id appears nowhere in the code; it only needs to exist so
Google will issue tokens to the app.

Account linking is enabled with `trustedProviders: ['google']` and
`allowDifferentEmails: false`, so a user who registered with a password and
later used Google on the same address does not end up with two accounts.

OAuth clients (project `attayyibun-auth`):
- Web client id: `659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com`
- Android client id: `659173631996-v043u83qkebdirej7qos9o75drs4iam7.apps.googleusercontent.com`
- Redirect URIs: `https://attayyibun.com/auth/callback/google` and
  `http://localhost:3000/auth/callback/google` (note `/auth/`, not `/api/auth/` —
  Traefik routes `/api/*` to the NestJS container)
- Android client SHA-1 is the **release** keystore. Debug builds need the debug
  SHA-1 added to the same client or they fail with a developer error.

Build command:
```bash
flutter build apk --release --target-platform android-arm,android-arm64 \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=<WEB_CLIENT_ID>.apps.googleusercontent.com
```

> ⚠️ **The OAuth consent screen is still in Testing mode.** Until it is
> published, Google sign-in works only for accounts explicitly listed as test
> users. Scopes are `email`, `profile`, `openid` — all non-sensitive, so
> publishing needs no Google review.

> ⚠️ **Accounts created via Google arrive with no phone number.** That bypasses
> the phone-verification duplicate prevention discussed separately.

---

## 2. Flutter Android app

Commits `4a8e62c` + `7b4079d`. Lives at `apps/mobile/`. See `apps/mobile/README.md`
for build instructions and architecture.

A **real native client**, not a webview wrapper. No backend change was needed:
better-auth's session cookie works in a persistent Dart cookie jar, so the
cookie-only guard on `/api/*` accepts the app as-is.

### Three load-bearing server behaviours

Break any of these and auth silently dies. All are commented at the call sites.

1. **`Origin: https://attayyibun.com` on every POST to `/auth/*`.** better-auth's
   `originCheckMiddleware` rejects non-GET auth requests without a trusted Origin as
   soon as the jar holds any cookie for the host → `403 MISSING_OR_NULL_ORIGIN`.
2. **`GET /auth/get-session` returns HTTP 200 with a JSON `null` body when signed
   out**, not 401.
3. **Error bodies have three shapes** — `{message}`, `{message: [...]}` from the
   validation pipe, and a **bare JSON string** on 429. All normalised in
   `ApiException`. better-auth uses a different shape again: `{code, message}`.

Session cookie in production is `__Secure-better-auth.session_token` (the
`__Secure-` prefix is applied because the origin is HTTPS). Value format is
`<token>.<hmac>`; the API splits on the first `.` itself.

### The bug the emulator caught

Flutter's template declares `android.permission.INTERNET` only in the **debug and
profile** manifests. The first release APK shipped without it — it installed,
launched, and looked perfect while being unable to make a single network call.
`flutter analyze`, the release build, and signature verification all passed on that
broken binary. Only running it surfaced this. Fixed in `7b4079d`.

**Lesson for next time: static checks cannot validate an Android release build.**

### Not implemented

Photo upload (`POST /api/photos`, multipart), admin panel, push notifications, 2FA
enrolment. Admin accounts with 2FA cannot complete sign-in in the app and are
directed to the website.

---

## 3. Distribution

**R2 was used briefly and then removed** — the site is hosted on Hetzner, which
already has storage, so R2 was redundant. As of the end of this session:

- Object deleted, public dev-url disabled, and bucket `at-tayyibun-downloads`
  deleted entirely. The old `pub-dcd3d717132b4d69b8e132eb667cf0ef.r2.dev` URL now
  returns 401.
- The pre-existing `novicetutor-app` bucket (a different project) was left untouched.
- Wrangler remains authenticated on this machine; config lives at
  `~/Library/Preferences/.wrangler` (not `~/.wrangler`).

**The APK is therefore not hosted anywhere right now.** The build artifact is at
`apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (gitignored) and can be
rebuilt at any time — see `apps/mobile/README.md`. To distribute it from Hetzner,
serve it with `Content-Type: application/vnd.android.package-archive`.

Last built: v0.1.1, 36.9 MB, SHA-256
`e285711689f39b6fdf1e47e999db56de1248053f39bbe2b30fb0d0213c521811`.

Android 14+ blocks unknown-source installs by default — users must allow it for
their browser.

### Signing

- Keystore: `~/.android-keystores/at-tayyibun-release.jks` (**outside the repo**)
- Credentials: `apps/mobile/android/key.properties` (**gitignored** — verified)
- Cert: `CN=At-Tayyibun`, SHA-256 `373658e50f2f5dda5441f1ed0f92800bf667337cc9d6c3ae2d06b591d02d3bae`

> ⚠️ **Back up that keystore.** It permanently identifies the app. If this is ever
> published to the Play Store and the key is lost, updating that listing becomes
> impossible. It is currently on one machine with no backup.

---

## 4. Toolchain installed this session

Neither existed before; both were installed via Homebrew.

- **OpenJDK 17** at `/opt/homebrew/opt/openjdk@17` — keg-only, so builds need
  `export JAVA_HOME=/opt/homebrew/opt/openjdk@17; export PATH="$JAVA_HOME/bin:$PATH"`.
  (Used the formula, not the Temurin cask, because the cask installs into
  `/Library/Java` and needs sudo, which hangs a non-interactive shell.)
- **Flutter 3.44.9** at `/opt/homebrew/share/flutter`, binaries linked into
  `/opt/homebrew/bin`.
- **Android emulator + system image** `system-images;android-35;google_apis;arm64-v8a`
  (3.8 GB) and AVD **`attayyibun_test`** (Pixel 7, API 35, arm64).

Launch it with:
```bash
~/Library/Android/sdk/emulator/emulator -avd attayyibun_test -no-snapshot -gpu swiftshader_indirect &
~/Library/Android/sdk/platform-tools/adb wait-for-device
```

### Known environment trap

The repo's `node_modules` is a **Windows install copied onto macOS** — it contains
`@esbuild/win32-x64` and `@next/swc-win32-x64-msvc` with no darwin binaries. So
`next`, `drizzle-kit`, and any JS build **cannot run on this machine** until a fresh
`pnpm install`. `tsc` is pure JS and does work. `npx <pkg>` also works (it fetches
correct platform binaries).

---

## 5. What is verified vs not

### Verified
- `flutter analyze` clean; `tsc --noEmit` clean on both `apps/web` and `apps/api`.
- Release APK signed with the release key (v2 scheme), `INTERNET` present, label
  "At-Tayyibun", ABIs arm64-v8a + armeabi-v7a.
- **App runs on Android 15 (emulator)** — no `FATAL`, no `E/flutter`.
- **Auth chain proven end-to-end against production**: entering bad credentials in
  the app produced "Invalid email or password" rendered from the live server. Proves
  the TLS POST reached better-auth, the `Origin` header was accepted, and the error
  body was parsed correctly.
- Launch session probe hits `/auth/get-session`, receives `null`, routes to login.
- Downloaded the APK from the R2 URL and installed those exact bytes — runs.
- Live contract probes by curl: `get-session` → 200 `null`; `/api/profiles`
  unauthenticated → 401; bad sign-in → 401 `INVALID_EMAIL_OR_PASSWORD`.

### NOT verified
- **No successful login anywhere** — no test credentials were available. Everything
  behind auth in the mobile app (browse, profile detail, requests, profile save) has
  never been exercised. The plumbing is proven; the authenticated screens are not.
- ~~**Migration `0001` has not been applied** to any database.~~ Applied to the
  production Neon database on 2026-08-10; index and row counts verified after the
  transaction committed. The second-decline 500 path itself has still not been
  exercised end to end.
- **No Google sign-in has ever completed.** Verified up to the account picker:
  the app built with the real web client id, logcat showed
  `[GetGoogleIdOperation] Operation succeeded` and
  `TYPE_GOOGLE_ID_TOKEN_CREDENTIAL meets all filtering conditions` (so Google
  accepts the `serverClientId`), and Google's native sign-in screen launched.
  Cancelling returned cleanly with no crash. Finishing it requires typing a real
  Google account password, so the last hop — ID token → `/auth/sign-in/social` →
  session cookie — is untested. The web redirect flow is entirely untested.
- Most of the web/API fixes have still never been exercised at runtime. The
  `node_modules` situation is now resolved (see below) and `next build` passes,
  but only the home page and the mobile menu were actually loaded in a browser.

### Correction to an earlier version of this document

An earlier revision said the web app could not be run on this machine at all.
That is no longer true: `node_modules` was reinstalled for macOS, the zod
conflict was fixed, and `next build` now succeeds. One manual step was needed —
`@next/swc-darwin-arm64@15.1.4` was side-loaded by hand because the lockfile's
optional-dependency entries did not produce it. That directory is untracked, so
a future `pnpm install` may wipe it; if builds suddenly complain about a missing
SWC binary, that is why.

---

## Outstanding actions

1. ~~**Push the branch, then merge to `main` to deploy.**~~ **Done 2026-08-10.**
   Branch pushed, then `main` fast-forwarded `70ff087..4cbed2e` and pushed, which
   fired the Dokploy `push` trigger for both apps.
2. ~~**Run migration `0001`**~~ **Done 2026-08-10, before the merge.** Applied
   directly against the production Neon database (the same `DATABASE_URL` the
   Dokploy API app uses) in a single transaction, because `drizzle-kit migrate`
   was not usable: `drizzle.__drizzle_migrations` does not exist on that database,
   so drizzle would have tried to replay `0000` against a live schema. Result:
   old `info_requests_requester_id_status_key` dropped, five `PENDING` rows already
   past `expires_at` flipped to `EXPIRED` (no requester held two pending rows), and
   the partial unique index `info_requests_requester_pending_key ON (requester_id)
   WHERE status = 'PENDING'` created and verified.
   There is still no migration step in the deploy — `Dockerfile.api` ends at
   `CMD ["node", "dist/src/main"]` — so `0002` onwards needs the same treatment.
3. **Rotate the Google client secret.** The original was pasted into a chat
   transcript and must be considered compromised. Google Cloud → Clients → web
   client → Add secret, then delete the old one. **Deliberately deferred by the
   owner** until the app is fully shipped; web Google sign-in stays broken until
   then, which bounds the exposure.
4. **Set the Google env vars in Dokploy on the WEB app** (`kR_VYSPSAMuzU6peeBtt9`),
   not the API — `auth.ts` runs inside the Next.js server:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (the rotated value). **Not set** —
   deferred with step 3. Confirmed harmless to deploy without them: better-auth
   only throws `CLIENT_ID_AND_SECRET_REQUIRED` inside `createAuthorizationURL`
   (`@better-auth/core/social-providers/google.mjs`), i.e. when the Google button
   is clicked — not at `betterAuth()` init, so the rest of the site is unaffected.
   `verifyIdToken` checks `audience: options.clientId` only, so setting
   `GOOGLE_CLIENT_ID` alone is enough to unblock the Android path.
   `apps/web/.env.local` holds the client id plus a `ROTATE-ME` placeholder for
   local development.
5. **Publish the OAuth consent screen**, or Google sign-in only works for listed
   test users.
6. Test a real login on the Android app, and a real Google sign-in on both
   platforms.
7. Back up the release keystore.
8. Add a `.gitattributes` — 39 files had been silently converted to CRLF; they were
   normalised back to LF this session, but nothing prevents a recurrence.
9. **Rotate the GitHub personal access token** that was pasted into the chat
   transcript.

---

## Deferred / known issues not addressed

- **No request-expiry job exists.** `expiresAt` is set to 72 h (docs still say 24 h)
  but nothing flips `PENDING`→`EXPIRED` on a timer. The `info_requests_expires_at_idx`
  index was built for a job that was never written. Cancel solves the immediate
  complaint; a sweeper is the durable fix.
- `GET /api/profiles/:publicId` is `@Public()`, which short-circuits the guard before
  `req.user` is populated — so `isFullView` is **always false** and `membershipTier`
  is never returned, even with a valid session. Do not build on those fields.
- `apps/web/src/app/verify-email/page.tsx` writes a dead `localStorage.accessToken`
  (better-auth is cookie-based; nothing reads it).
- `NEXT_PUBLIC_WEB_URL` is read by `auth-client.ts` and `layout.tsx` but exists in
  neither `.env` nor `.env.example` — silently falls back to `localhost:3000`.
- `sendVerificationEmail` throws when `RESEND_API_KEY` is unset, and now runs on every
  signup. An environment without the key will fail signups after the user row is
  created, leaving orphaned unverified accounts.
- Guardian details currently live inside the encrypted `biodata` blob as an interim.
  A dedicated table is the right long-term answer.

---

## Security notes (relevant to planned pentesting)

Observations from reading the code — none of these were exploited or tested.

- **Auth is entirely cookie-based.** `BetterAuthGuard`
  (`apps/api/src/common/guards/better-auth.guard.ts`) accepts only the cookie names
  `better-auth.session_token` and `__Secure-better-auth.session_token`. Despite
  `@ApiBearerAuth()` decorators, there is no bearer-token path.
- **Auth gating is 100 % client-side on the web.** There is no `middleware.ts`; every
  guard is a `useEffect` redirect. Page *data* is protected by the API, but route
  protection is cosmetic.
- **CORS on the Nest app is `origin: true` with `credentials: true`** — it reflects
  any Origin (`apps/api/src/main.ts`). It sits behind the Next proxy, but worth
  reviewing whether it is reachable directly.
- **Rate limits are per-IP and the API sits behind a proxy**, so limits are likely
  keyed on the proxy's IP and effectively shared across all users unless trust-proxy
  is configured. I raised the `short` bucket 3→20/s this session.
- `GET /api/requests/shared/:token` is `@Public()` and returns shared phone/email.
  One-time use is enforced via `tokenUsedAt`. Token is 32 bytes from
  `EncryptionService.generateToken`.
- `GET /api/profiles/:publicId` is `@Public()` — unauthenticated profile enumeration
  by `publicId` (12-char random id) is possible by design.
- Field-level encryption (AES-256-GCM) covers `lastName`, `bio`, and the `biodata`
  blob. Decryption failures are swallowed and degrade to empty rather than erroring.
- `users.phone` has a unique index; a duplicate surfaces as a raw driver error that
  the signup form string-matches on `/duplicate|unique/i` — usable as a phone-number
  oracle.
- The `two_factor` plugin rate-limits `/auth/two-factor/*` to 3 requests / 10 s.
- 2FA is enforced for `SUPER_ADMIN` only.

### Credential hygiene

A **GitHub personal access token was pasted in plaintext into the chat** during this
session. It is now in the conversation transcript and any associated logs. It should
be treated as compromised and **revoked/rotated** at
https://github.com/settings/tokens regardless of whether it was used.
