# Session handoff — 2026-08-10

Covers two pieces of work: fixing seven client-reported bugs in the web/API, and
building a Flutter Android client distributed as a signed APK on Cloudflare R2.

Branch: **`fix/client-reports-and-android-app`** (3 commits, branched off `main`).

> ⚠️ **Not yet pushed at time of writing.** See [Outstanding actions](#outstanding-actions).

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
- **The web/API fixes have never been run.** `node_modules` is unusable on this
  machine, so `pnpm dev` and `pnpm build` were never executed. Type-checking passed;
  nothing was exercised at runtime.
- **Migration `0001` has not been applied** to any database.
- The web mobile-layout fixes were never viewed in a browser.

---

## Outstanding actions

1. **Push the branch, then merge to `main` to deploy.** It is committed locally but
   not on the remote:
   ```bash
   git push -u origin fix/client-reports-and-android-app
   ```
   Dokploy auto-deploys **only from `main`** (`DEPLOYMENT_NOTES.md`). Pushing this
   feature branch will **not** deploy anything — it needs a merge/PR into `main`.
   Do step 2 first: deploying the API before the migration runs leaves the
   second-decline 500 in place.
2. **Run migration `0001`** before deploying the API, or declining a second request
   will keep 500-ing.
3. `pnpm install` on a machine (or after clearing `node_modules`) to make the JS
   toolchain usable, then actually run the web app and verify the fixes.
4. Test a real login on the Android app with valid credentials.
5. Back up the release keystore.
6. Consider a custom domain for the APK instead of the public `r2.dev` URL.
7. Add a `.gitattributes` — 39 files had been silently converted to CRLF; they were
   normalised back to LF this session, but nothing prevents a recurrence.

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
