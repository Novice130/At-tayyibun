# At-Tayyibun — Android app

A native Flutter client for the At-Tayyibun matrimony platform. It talks to the
existing production backend at `https://attayyibun.com` — there is no separate
mobile API and no backend change was required.

## How auth works

Everything is cookie-based, exactly like the website:

- `POST /auth/sign-in/email` returns a `__Secure-better-auth.session_token`
  cookie (better-auth applies the `__Secure-` prefix because the origin is HTTPS).
- A `PersistCookieJar` (see `lib/core/api_client.dart`) stores that cookie on
  disk, so the user stays signed in across app restarts.
- The NestJS guard on `/api/*` reads the same cookie. There is no bearer-token
  path on the server, so the cookie jar *is* the session.

Two non-obvious rules are baked into the Dio interceptor and must not be removed:

1. **`Origin: https://attayyibun.com` is sent on every POST to `/auth/*`.**
   better-auth runs an origin check on non-GET auth routes and rejects requests
   without a trusted `Origin` as soon as the jar holds any cookie for the host.
   Drop this header and every action after the first sign-in fails with
   `403 MISSING_OR_NULL_ORIGIN`.
2. **`GET /auth/get-session` answers `200` with a JSON `null` body when signed
   out** — not `401`. `AuthRepository.getSession()` treats `null` as signed-out.

## Sign-up

The server sets `requireEmailVerification: true`, so `sign-up/email` returns no
session. The app deliberately ends on a "check your email" screen. Opening the
emailed link signs the user in **on the website**, not in the app — they then
return to the app and sign in. That is inherent to the server's verification
flow, not an app limitation.

## Layout

```
lib/
  core/          api client, error normalisation, theme, constants
  models/        plain Dart models mirroring the API response shapes
  repositories/  one class per API surface
  screens/       login, signup, browse, profile detail, requests, profile, edit
  widgets/       shared avatar / state / badge widgets
  providers.dart Riverpod wiring + auth controller
  router.dart    go_router with auth redirects
```

## Build

Requires a JDK 17 on PATH. This machine has it via Homebrew (keg-only):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$PATH"

flutter pub get
flutter analyze
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk` (universal APK — one
file that works on every ABI, since it is distributed by direct download).

### Signing

Release builds are signed with a keystore kept **outside** the repo at
`~/.android-keystores/at-tayyibun-release.jks`. Credentials live in
`android/key.properties`, which is gitignored.

> ⚠️ Back up that keystore. It permanently identifies the app — if it is ever
> published to the Play Store and the key is lost, updates to that listing
> become impossible.

If `key.properties` is missing (e.g. a fresh clone), the build falls back to
debug signing so it still compiles.

## Not in this version

Photo upload (`POST /api/photos`), the admin panel, push notifications, and 2FA
enrolment. Admin accounts with 2FA enabled cannot complete sign-in in the app —
they are told to use the website.
