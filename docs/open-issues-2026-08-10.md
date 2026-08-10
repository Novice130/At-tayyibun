# Open issues — as of 2026-08-10 (post-deploy)

Written so this survives a lost session. Everything below is **unfixed** unless
marked otherwise — as of 2026-08-10 all of section A is fixed and awaiting a
deploy, and B8 is done. Companion to `docs/session-handoff-2026-08-10.md`, which
describes the work that shipped; this file is only what is still wrong or still
owed.

Deploy state at time of writing: `main` is live on both containers
(web `attayibun-app-yfc8kv`, API `attayibun-api-nvxlws`). Migration `0001` is
applied to the production Neon database. The Android APK is served at
`https://attayyibun.com/downloads/at-tayyibun.apk`.

---

## A. Code defects found by review of `70ff087..4cbed2e`

Ordered by severity. Each was traced through the code; none were reproduced at
runtime, so treat the failure scenarios as arguments, not observations.

### A1. HIGH — a stale signup seed silently wipes the encrypted biodata blob

**FIXED 2026-08-10.** The hydrate effect now GETs the profile *before* touching
the seed and applies it only when `profileComplete` is false; the seed is
stamped with the signup email and a timestamp and is discarded when either the
account or the 7-day age check fails; the guardian keys are merged over the
existing `biodata` instead of replacing it.

**Where:** `apps/web/src/app/profile/setup/page.tsx` (hydrate effect, ~line 121)
against `apps/api/src/modules/profiles/profiles.service.ts` (`updateMyProfile`).

The signup seed moved from `sessionStorage` to `localStorage`, which never
expires, and it now carries guardian keys. Every visit to `/profile/setup` that
finds a seed fires `PUT /profiles/me` with `biodata: {creatorRole, guardian…}`.
The API replaces the blob wholesale:

```ts
if (data.biodata !== undefined) updateData.biodataJsonEnc = encryptJson(data.biodata);
```

**Failure:** user signs up in browser A (seed written there), opens the
verification link in browser B, completes the wizard in B. Weeks later they open
`/profile/setup` in browser A. The stale seed PUT lands before the GET hydrates,
so `education`, `profession`, `partnerPreferences`, `dealBreakers`, `hideName`
and `hideLocation` are replaced by the two guardian keys, and `firstName` /
`gender` are overwritten with the signup-time values. The wizard then hydrates
from the already-wiped record, so the user sees the damage as "my profile reset
itself" with no way to tell what was lost.

**Fix:** gate the seed PUT on `!profileComplete`; stamp the seed with a user id
and timestamp and discard it when either fails to match. A merge-instead-of-
replace on `biodata` in the API would be defence in depth.

### A2. MEDIUM — Google sign-ups never get a profile, and their requests notify nobody

**FIXED 2026-08-10.** `signIn.social` now uses `callbackURL:
'/profile/setup?new=1'`, and the wizard redirects to `/browse` when the profile
is already complete *and* `?new=1` is present (it is also the Edit Profile
target, so the redirect cannot be unconditional). `createRequest` now rejects
with a 400 when either side has no profile, instead of writing a row nobody is
told about. The no-phone-number gap for Google accounts remains open.

**Where:** `apps/web/src/lib/auth.ts` (~line 196, `socialProviders.google`) and
`apps/api/src/modules/requests/requests.service.ts` (`createRequest`).

Email signup passes `callbackURL: '/profile/setup'`. Google sign-in passes
`/browse`, and nothing routes a profile-less user to the wizard — there is no
`middleware.ts` and no `profileComplete` gate anywhere.

So a Google user lands on `/browse` with `profile === null`: browse shows both
genders because `myGender` is unknown, `/profile` renders empty, and
`createRequest` only emails the target under
`if (requester?.profile && target.profile)`. The request row is still created and
still consumes the requester's one-pending-request slot (see the new partial
index from migration `0001`), but **the target is never emailed** and only ever
finds out by opening `/requests` unprompted.

**Fix:** send social sign-ins to `/profile/setup`, or reject
`POST /api/requests` when either side has no profile. Related known gap: Google
accounts also arrive with no phone number, bypassing the duplicate-prevention
that `users.phone`'s unique index provides.

### A3. MEDIUM — `signIn.social` errors are swallowed; the button hangs forever

**FIXED 2026-08-10.** The handler destructures `{error}`, clears
`googleLoading` and shows the message. Production still cannot complete Google
sign-in until B1 — but it now says so instead of hanging.

**Where:** `apps/web/src/app/login/LoginForm.tsx` (~line 33).

better-auth's client returns `{data, error}` and does not throw unless
`fetchOptions.throw` is set — which is exactly why `handleSubmit` above it
destructures the result for `signIn.email`. The Google handler discards the
return value and only catches thrown exceptions.

**Failure:** any failure leaves `googleLoading === true` forever — a disabled
"Redirecting…" button and no message. **This is production's current state**,
because `GOOGLE_CLIENT_SECRET` is deliberately unset pending rotation (see B1)
and `auth.ts` casts it with `as string`, so the provider registers as broken and
`createAuthorizationURL` throws `CLIENT_ID_AND_SECRET_REQUIRED`.

**Fix:** destructure `{error}`, clear `googleLoading`, surface the message.

### A4. MEDIUM — mobile "Try again" can never clear the error state

**FIXED 2026-08-10.** `_load` resets `_error` alongside `_loading`.

**Where:** `apps/mobile/lib/screens/profile_detail_screen.dart` (~line 34).

`_load()` sets `_loading = true` but never resets `_error`, and `build` returns
`ErrorView` whenever `_error != null`. Open a profile while offline, restore
connectivity, tap "Try again": the fetch succeeds and `_profile` is populated,
but the error screen stays until the route is popped and re-entered.

**Fix:** add `_error = null` to the `setState` at the top of `_load`.

### A5. LOW/MEDIUM — a failed page-2 fetch discards the grid and skips a page

**FIXED 2026-08-10.** Failures route through `_handleLoadFailure`, which rolls
`_page` back and shows a snackbar when the failure was a load-more, and only
sets `_error` for a failed first page.

**Where:** `apps/mobile/lib/screens/browse_screen.dart` (~line 94, `_onScroll`).

`_page` is incremented *before* the request. On `ApiException` the catch sets
`_error`, so `_buildBody` replaces the whole populated grid with a full-screen
`ErrorView`, and `_page` stays advanced — the failed page is never re-requested
even on a successful retry.

**Fix:** roll `_page` back in the catch; show load-more failures as a snackbar or
footer rather than by setting `_error`.

### A6. LOW — a malformed payload hangs the mobile spinner forever

**FIXED 2026-08-10.** Both screens have a bare `catch (_)` that sets an error
state and clears the spinner.

**Where:** `apps/mobile/lib/screens/browse_screen.dart` (~line 62); same shape in
`profile_detail_screen._load`.

`ApiClient._send` converts only `DioException`. Anything thrown by
`BrowsePage.fromJson` — e.g. `json['publicId'] as String` on a row missing
`publicId` — escapes as a `TypeError`, so `_loading` is never cleared and the
screen shows `LoadingView` indefinitely.

**Fix:** add a bare `catch (_)` fallback that sets an error state.

### A7. LOW — the navbar badge goes stale exactly where it matters

**FIXED 2026-08-10.** The badge lives in the Navbar's own hook instance, so the
requests page calling its own `refresh` would have changed nothing; it now
dispatches a window event (`notifyRequestsChanged`) that every instance of the
hook listens for.

**Where:** `apps/web/src/lib/hooks.ts` (~line 80, `useIncomingRequestCount`) and
`apps/web/src/app/requests/page.tsx`.

The hook only refetches when `pathname` changes, and the requests page never
calls the exported `refresh`. Accept or decline every pending request and the red
count keeps showing the old number until the user navigates away and back.

**Fix:** call `refresh()` from `handleRespond` / `handleCancel`.

### A8. LOW — `toE164` is unbounded but `users.phone` is `varchar(20)`

**FIXED 2026-08-10.** The `+` branch is bounded to E.164's 15 digits on web and
mobile. The unreliable `duplicate|unique` message match is still there.

**Where:** `apps/web/src/app/signup/SignupForm.tsx` (~line 128); identical logic
at `apps/mobile/lib/screens/signup_screen.dart:42`.

The third branch returns `+${digits}` for anything starting with `+` that has at
least 7 digits, with no upper bound. Paste `+1 (555) 123-4567 ext 8901234567` and
Postgres raises `value too long for type character varying(20)` — an opaque 500
at signup.

Note the same path assumes a unique violation contains `duplicate|unique`; a
`users_phone_key` collision surfaces through better-auth as a generic server
error, so the friendly "already registered" message likely never fires either.

**Fix:** validate length and format before calling `signUp.email`.

### Reviewed and found clean

Migration `0001` (journal entry, snapshot `prevId` chain, partial-index
definition, and the pre-create `UPDATE`s that release rows which would violate
it); `audit_logs.resource_id` has no FK to `info_requests`, so the hard delete in
`cancelRequest` is safe; `sql` is imported in both `db-schema.ts` and
`schema.ts`; `emailVerification.sendOnSignIn` exists in better-auth 1.5.6;
`api.delete` exists on the web client; `publicId` is set for social users via the
`databaseHooks.user.create.before` hook; the `!== undefined` guards in
`updateMyProfile` and the `publicFields` merge are correct; the zod 3→4 bump
touches no direct `zod` import in `apps/web`.

---

## B. Operational tasks still owed

### B1. Rotate the Google client secret — **deferred by the owner, on purpose**

The original web-client secret was pasted into a chat transcript and must be
considered compromised. The owner chose on 2026-08-10 to defer rotation until the
app is fully shipped, and asked to be reminded then.

Until it is done, `GOOGLE_CLIENT_SECRET` is unset on the Dokploy **web** app, so
web Google sign-in cannot work at all (and fails badly — see A3). `verifyIdToken`
checks `audience: options.clientId` only, so the Android ID-token path needs no
secret; `GOOGLE_CLIENT_ID` **is** set and live.

Steps when the time comes: Google Cloud → Clients → web client → Add secret →
delete the old one → set `GOOGLE_CLIENT_SECRET` on app `kR_VYSPSAMuzU6peeBtt9`
(the **web** app, not the API — `auth.ts` runs in the Next.js server) → redeploy,
because Dokploy only applies env at container create.

### B2. Publish the OAuth consent screen

Still in Testing mode, so Google sign-in only works for explicitly listed test
users. Scopes are `email`, `profile`, `openid` — all non-sensitive, so no Google
review is required. Needs a Google Console login.

### B3. The API app does not receive the GitHub push webhook — **NOT REPRODUCIBLE; the earlier conclusion was wrong**

Re-checked on 2026-08-10 against `application.one` for `9E23qdq8WrdmisgYgis94`.
The API app's deployment history contains a webhook-driven row for **every**
push that day, each finishing `done`:

| time (UTC) | commit | description prefix |
|---|---|---|
| 13:02 | `4cbed2e` | `Hash:` — the **manual** deploy, ended `cancelled` |
| 13:12 | `4cbed2e` | `Commit:` — webhook, done 13:16 |
| 13:16 | `75f8f90` | `Commit:` — webhook, done 13:16 |
| 13:38 | `15490e5` | `Commit:` — webhook, done 13:39 |
| 15:27 | `b6a8221` | `Commit:` — webhook, done 15:28 |

Dokploy writes `Hash: <sha>` for a manual deploy and `Commit: <sha>` for a
webhook one, which is what separates the two 13:0x–13:1x rows. So the API did
receive the push for the merge; what actually happened is that the manual
deploy was fired first, was cancelled, and the webhook row that arrived ten
minutes later was read as absent. The two pushes after it deployed the API
without any intervention.

**Revised guidance:** merges deploy both apps. Still worth probing a
new-build-only route after a release, but do not plan on deploying the API by
hand.

### B4. There is no migration step in the deploy

`Dockerfile.api` ends at `CMD ["node", "dist/src/main"]`. Migration `0001` had to
be applied by hand, and `drizzle-kit migrate` was **not** usable: the production
database has no `drizzle.__drizzle_migrations` table, so drizzle would have tried
to replay `0000` against a live schema. `0002` onward needs the same manual
treatment — run the SQL in a transaction — or an init container that runs
migrations before the API starts.

### B5. Untested paths

- **No successful login has ever been performed in the Android app.** Every
  authenticated screen (browse, profile detail, requests, profile save) is
  unexercised. The plumbing is proven; the screens are not.
- **No Google sign-in has ever completed** on either platform.
- The published APK (`931920c8…`, v0.1.1+2) is a later build than the one the
  handoff originally described, and has not been re-tested on a device since.

### B6. Back up the release keystore

`~/.android-keystores/at-tayyibun-release.jks` exists on exactly one machine with
no backup. Losing it makes updating a Play Store listing impossible forever.

### B7. Rotate the GitHub personal access token

Also pasted into a chat transcript.

### B9. The Dokploy API app's env block has been read into a chat transcript

Reading `application.one` to diagnose B3 returned the API app's whole `env`
string, so `DATABASE_URL` (including the Neon role password), `BETTER_AUTH_SECRET`,
`ENCRYPTION_KEY` and `RESEND_API_KEY` are now in the same exposure class as B1
and B7. Nothing indicates misuse; the honest position is that they are no longer
secret-by-default.

`ENCRYPTION_KEY` is the awkward one — rotating it means re-encrypting every
`biodataJsonEnc` blob, not just setting a new value, so it needs a migration
script rather than an env edit. The other three rotate cleanly (Neon password
reset, a new `BETTER_AUTH_SECRET` — which invalidates every session — and a new
Resend key). Same call as B1: the owner may reasonably defer these until ship
day, but they should be done in one pass with B1 and B7 rather than forgotten.

### B8. Add a `.gitattributes` — **DONE 2026-08-10**

39 files were silently converted to CRLF once and normalised back to LF.
A repository-root `.gitattributes` now pins `* text=auto eol=lf`, keeps `.bat` /
`.cmd` / `gradlew.bat` on CRLF, and marks binaries. The 45 files still stored
CRLF in the index were renormalised in the same commit.

---

## C. Known design gaps, carried forward

Not regressions — these were already true and remain unaddressed.

- **No request-expiry job exists.** `expiresAt` is set to 72 h but nothing flips
  `PENDING` → `EXPIRED` on a timer; only the target responding does. The
  `info_requests_expires_at_idx` index was built for a sweeper that was never
  written. Migration `0001` had to expire five stale rows by hand for this
  reason.
- **Web auth gating is entirely client-side.** No `middleware.ts`; every guard is
  a `useEffect` redirect. Page *data* is protected by the API, so this is a UX
  and information-disclosure-shape issue rather than an access-control hole — but
  route protection is cosmetic.
- `GET /api/profiles/:publicId` is `@Public()`, which short-circuits the guard
  before `req.user` is populated, so `isFullView` is always false and
  `membershipTier` is never returned even with a valid session. Do not build on
  those fields.
- CORS on the Nest app is `origin: true` with `credentials: true` — it reflects
  any Origin. It sits behind the Next proxy; worth checking whether the container
  is reachable directly.
- Rate limits are per-IP behind a proxy, so they are likely keyed on the proxy's
  address and shared across all users unless trust-proxy is configured.
- `sendVerificationEmail` throws when `RESEND_API_KEY` is unset and now runs on
  every signup, so an environment missing the key fails signups *after* the user
  row is created, leaving orphaned unverified accounts.
- Guardian details live inside the encrypted `biodata` blob as an interim; a
  dedicated table is the right answer (and would defuse A1).
- `apps/web/src/app/verify-email/page.tsx` writes a dead
  `localStorage.accessToken` that nothing reads.
- `NEXT_PUBLIC_WEB_URL` is read by `auth-client.ts` and `layout.tsx` but is set
  in neither `.env` nor `.env.example`; it silently falls back to
  `localhost:3000`.

---

## D. Suggested order

Steps 1, 2 and 4 of the original order are done (all of section A). What is left:

1. **Deploy section A.** Web carries A1, A2, A3, A7 and A8; the API carries the
   `createRequest` guard. Per the revised B3, one push deploys both.
   The mobile fixes (A4, A5, A6, A8) need a new APK build and a refreshed
   checksum on `/download`, whose version, size and SHA-256 are hardcoded
   constants in `apps/web/src/app/download/page.tsx`.
2. B1 + B2, which unblock Google sign-in end to end, then B5's first real login
   test. Note A2 changed where a Google sign-in lands, so that test now exercises
   the wizard.
3. B3 and B4, which are deploy-reliability work and will keep costing time on
   every future release.
4. The remainder of B: B5 (device testing), B6 (keystore backup), B7 (token
   rotation).
