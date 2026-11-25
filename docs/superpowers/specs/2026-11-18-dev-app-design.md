# Dev app (mobile → staging) — design

Date: 2026-11-18. Status: approved, implemented on `feat/dev-app`.

## Intent

All mobile testing has happened against production (`attayyibun.com`),
because the only build talks to prod. Staging already exists
(`staging.attayyibun.com`, own Neon DB). The owner wants an app identical to
the real one that talks to staging, so changes are tested there first and only
then shipped to production.

## Goals / non-goals / anti-goals

- Goal: "At-Tayyibun Dev", installable next to the real app on iOS
  (TestFlight) and Android (direct APK), talking only to staging.
- Goal: impossible to confuse with the real app (name, icon band, banner).
- Non-goal: separate Firebase / Google / Apple / Resend accounts. Owner chose
  to share prod's; only the database is separate.
- Non-goal: Play Store listing for the dev app (optional later).
- Anti-goal: a dev build talking to prod, or a prod build talking to staging.

## Approaches considered

- **A. Same app, built with a staging URL.** One build flag. Installing it
  replaces the real app on the phone, and TestFlight can't tell them apart.
- **B. Separate app via build flavors** (chosen by owner). Own bundle ID
  (`.dev` suffix), name, icon, TestFlight entry. Needs one-time console setup
  (Firebase apps, Google iOS/Android OAuth clients, Apple App ID, ASC record).
- Not considered further: a runtime server switch inside one app (a settings
  toggle). It risks prod users landing on staging and mixes cookie jars.

## Design

- Flutter flavors `prod` and `dev`. The backend is derived in Dart from
  Flutter's `appFlavor` (`lib/core/env.dart`): `dev` → staging, `prod` or no
  flavor → prod, anything else fails. Every URL, the auth `Origin` header and
  the cookie host follow from `kBaseUrl`, so this is the single switch.
- Android: `productFlavors` with `applicationIdSuffix = ".dev"` and an
  `appName` manifest placeholder. AGP 9 disables `resValue` by default, hence
  the placeholder.
- iOS: `Debug/Release/Profile-{prod,dev}` configurations and `prod`/`dev`
  schemes. Bundle ID, display name and Google iOS client live in
  `ios/Flutter/{prod,dev}.xcconfig`. The original `Debug/Release/Profile` +
  `Runner` scheme remain and build prod. Icon set `AppIcon-dev`.
- Firebase: `lib/firebase_options_dev.dart` throws until the dev apps are
  registered. It never reuses prod app IDs.
- Server: staging `APPLE_APP_BUNDLE_ID` must be the dev bundle ID (native Apple
  tokens carry it; better-auth takes one value). Google keeps verifying the web
  client. Firebase project unchanged.
- Upload script: `--flavor prod|dev`, separate `ExportOptions-dev.plist`
  (automatic signing), and a guard that the archive's bundle ID matches the
  flavor.

## Blocker found while designing

Staging `/api/*` returns 500 while `/auth/*` works. The web→api hop or the api
container is failing. This must be fixed before the dev app is useful. It is
tracked separately (needs Dokploy access).

## Left to the owner

The console steps in `apps/mobile/README.md` → "Dev app → One-time console
setup".
