# At-Tayyibun — mobile app (Android and iOS)

A native Flutter client for the At-Tayyibun matrimony platform. It talks to the
same backend as the website — there is no separate mobile API.

One codebase builds two apps (see [Dev app](#dev-app)):

| Flavor | App | iOS bundle ID / Android package | Backend |
|--------|-----|---------------------------------|---------|
| `prod` | At-Tayyibun | `com.attayyibun.attayyibun` / `com.attayyibun.at_tayyibun` | `https://attayyibun.com` |
| `dev` | At-Tayyibun Dev | `com.attayyibun.attayyibun.dev` / `com.attayyibun.at_tayyibun.dev` | `https://staging.attayyibun.com` |

## How auth works

Everything is cookie-based, exactly like the website:

- `POST /auth/sign-in/email` returns a `__Secure-better-auth.session_token`
  cookie (better-auth applies the `__Secure-` prefix because the origin is HTTPS).
- A `PersistCookieJar` (see `lib/core/session_store.dart`) stores that cookie in
  the iOS Keychain or Android encrypted storage, so the user stays signed in
  across app restarts. It is excluded from backups. Sessions from older versions,
  which used a plain file, are moved on first launch and the file is deleted.
- The NestJS guard on `/api/*` reads the same cookie. There is no bearer-token
  path on the server, so the cookie jar *is* the session.

Two non-obvious rules are baked into the Dio interceptor and must not be removed:

1. **`Origin: <backend origin>` (e.g. `https://attayyibun.com`) is sent on every POST to `/auth/*`.**
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
flutter build apk --release --flavor prod   # real app
flutter build apk --release --flavor dev    # dev app (staging)
```

Output: `build/app/outputs/flutter-apk/app-<flavor>-release.apk` (universal
APK — one file that works on every ABI, since it is distributed by direct
download). Android builds now always need `--flavor`.

iOS: `flutter build ipa --release --flavor prod|dev`, or
`./scripts/upload_to_testflight.sh --flavor prod|dev` to archive, sign and
upload. Without `--flavor`, iOS falls back to the `Runner` scheme, which is the
prod app.

### Signing

Release builds are signed with a keystore kept **outside** the repo at
`~/.android-keystores/at-tayyibun-release.jks`. Credentials live in
`android/key.properties`, which is gitignored.

> ⚠️ Back up that keystore. It permanently identifies the app — if it is ever
> published to the Play Store and the key is lost, updates to that listing
> become impossible.

If `key.properties` is missing (e.g. a fresh clone), a release build fails with
an error saying so. Debug builds do not need it. The file holds `storeFile`,
`storePassword`, `keyAlias` and `keyPassword`.

### Crash reporting

Pass `--dart-define=SENTRY_DSN=...` to enable Sentry, and optionally
`--dart-define=SENTRY_ENVIRONMENT=...`. Without a DSN it never starts. See
`lib/core/crash_reporting.dart` for what is scrubbed.

### Store submission

`docs/store-submission.md` lists the inputs for the store forms.

## Dev app

"At-Tayyibun Dev" is the same app pointed at staging, so changes can be tried
without touching production users or data. It installs next to the real app,
has a red **DEV** band on its icon and a **STAGING** corner banner on every
screen.

How it is wired:

- The backend comes from the build flavor in Dart (`lib/core/env.dart`), not
  from a separate flag, so the app ID and the server can't disagree. An
  unknown flavor fails at launch.
- iOS: `ios/Flutter/prod.xcconfig` and `ios/Flutter/dev.xcconfig` hold the
  bundle ID, display name and Google iOS client; `Debug/Release/Profile-dev`
  build configurations and the `dev` scheme use them. Icon set `AppIcon-dev`.
- Android: `productFlavors` in `android/app/build.gradle.kts`; dev icons in
  `android/app/src/dev/res/`.
- Same Firebase project (`at-tayyibun-e3f79`), Google Cloud project, Apple team
  and Resend sender as prod. Only the database (staging Neon) is separate.

### One-time console setup

Until these are done the dev app builds on iOS but stops at launch with a
"Dev Firebase apps are not registered yet" error, and the Android dev build
fails with `No matching client found for package name
'com.attayyibun.at_tayyibun.dev'`.

1. **Firebase** (project `at-tayyibun-e3f79`)
   - Add an Android app `com.attayyibun.at_tayyibun.dev` with the same SHA-1
     and SHA-256 fingerprints as the prod Android app. Download
     `google-services.json` and replace `android/app/google-services.json`
     (the new file lists both packages).
   - Add an iOS app `com.attayyibun.attayyibun.dev`. Upload the same APNs key
     as the prod iOS app (phone sign-in needs it).
   - Copy the new apps' `apiKey` / `appId` into `lib/firebase_options_dev.dart`
     (replace the `throw`; same shape as `lib/firebase_options.dart`).
   - Authentication → Settings → Authorized domains: add
     `staging.attayyibun.com`.
2. **Google Cloud** (project of client `659173631996-…`)
   - OAuth client, type iOS, bundle ID `com.attayyibun.attayyibun.dev`. Put its
     client ID and reversed client ID into `ios/Flutter/dev.xcconfig`, and the
     client ID into the `AppEnv.dev` case of `kGoogleIosClientId` in
     `lib/core/constants.dart`.
   - OAuth client, type Android, package `com.attayyibun.at_tayyibun.dev`, same
     SHA-1 as prod.
   - The server keeps verifying against the web client (`GOOGLE_CLIENT_ID`), so
     no server change for Google.
3. **Apple Developer / App Store Connect**
   - App ID `com.attayyibun.attayyibun.dev` with Sign in with Apple.
   - New App Store Connect app "At-Tayyibun Dev" on that bundle ID. Use it for
     TestFlight only; never submit it for review.
   - Signing profile: `ExportOptions-dev.plist` uses automatic signing, so the
     upload script's API key lets Xcode create it.
4. **Staging server env** (Dokploy compose `attayyibun-staging`): set
   `APPLE_APP_BUNDLE_ID=com.attayyibun.attayyibun.dev`. Native Apple sign-in
   tokens carry the bundle ID, and better-auth accepts a single value.

### Test → ship

1. Deploy the change to staging (`web:staging` / `api:staging` images).
2. Test it in the dev app (and on `https://staging.attayyibun.com`).
3. Ship to production with `bin/prod deploy attayyibun <sha>` (infra repo), and
   a prod build of the app if mobile code changed.

## Not in this version

The admin panel, push notifications, deep links, and 2FA enrolment. Admin accounts with
2FA enabled cannot complete sign-in in the app — they are told to use the
website.
