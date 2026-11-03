# Store submission inputs

Facts read from `apps/mobile` code on branch `fix/public-claims`. These are
inputs for the App Store and Play forms, not legal statements. Anything the code
cannot settle is listed under "Owner must decide". Server retention, deletion
timing and third-party processors other than those named here are not covered,
because they cannot be read from the mobile code.

## Identifiers

| | |
|---|---|
| iOS bundle ID | `com.attayyibun.attayyibun` |
| Android application ID | `com.attayyibun.at_tayyibun` |
| Version in `pubspec.yaml` | `0.1.4+11` |
| Android minSdk | 24 |
| iOS deployment target (Podfile) | 15.0 |

## Data the app sends

All of it goes over HTTPS to `https://attayyibun.com` unless noted. Purpose in
every row: app functionality. None is used for tracking; the app has no ad or
analytics SDK and no tracking domains.

| Data | Where in the code | Apple label type |
|---|---|---|
| Name (signup, profile first/last name, Apple name) | `signup_screen`, `edit_profile_screen`, `auth_repository` | Name |
| Email | `login_screen`, `signup_screen`, `forgot_password_screen` | Email Address |
| Phone number | `verify_phone_screen`; also sent to Firebase Auth, which delivers the SMS | Phone Number |
| Account IDs (`id`, `publicId`), Google and Apple ID tokens | `models/user.dart`, `auth_repository` | User ID |
| Ethnicity, sect, religious practice, prayer frequency | `edit_profile_screen` | Sensitive Info |
| Bio, partner preferences, deal breakers, report details | `edit_profile_screen`, `moderation_repository` | Other User Content |
| Date of birth, gender, marital status, children, city, state, legal status, education, profession, diet, relocation, nikah intent | `edit_profile_screen` | Other Data Types |
| Crash stack traces, device and OS details, only if built with `SENTRY_DSN` | `core/crash_reporting.dart` | Crash Data (not linked) |

City and state are typed by the user, not read from device location: the app
requests no location permission. They are declared under Other Data Types for
that reason. The Play form has more specific categories; map them from this
table.

Password: sent to the server at sign-in and signup, and not stored by the app.

Not collected by the app: photos (avatars are a preset catalogue), contacts,
device location, microphone, camera, payment details, advertising ID.

Sensitive profile fields are shown to other members under the rules the server
applies; the app only renders what the API returns.

## Storage and transport on the device

- The session cookie is held in the iOS Keychain (this-device-only) or in Android
  encrypted storage, via `flutter_secure_storage`.
- Android backup is off (`allowBackup="false"`, `data_extraction_rules.xml`).
- Sign-out and account deletion clear the stored session.

## Crash reporting

Off unless built with `--dart-define=SENTRY_DSN=...`. When on: no user identity,
no request data, no exception message text, no screenshots, no view hierarchy,
no replay, no performance tracing, no session tracking.

Limit: `core/crash_reporting.dart` scrubs events created in Dart. Crashes caught
by the native iOS and Android SDKs do not pass through that code. They carry
device details and native stacks, and automatic native breadcrumbs are off.

If no DSN will be used for a release, remove the Crash Data entry from
`ios/Runner/PrivacyInfo.xcprivacy` and answer "no" on the forms.

## Permissions

| Platform | Declared by the app |
|---|---|
| Android | `INTERNET` in the main manifest. Plugins add more at merge; see the list below. |
| iOS | No usage-description strings. Sign in with Apple entitlement. URL scheme for Google Sign-In. |

Android permissions after merge, from a debug build of this branch (debug adds
tooling entries, so re-check against the release manifest before submitting):
see "Merged Android permissions" at the end of this file.

## Required review notes

Facts to state:

- Sign-in options: email and password, Google, Apple (iOS only), phone by SMS.
- New accounts must verify a phone number before using the app, unless exempt.
  The reviewer needs a working test account: **owner must supply** an account
  that is already phone-verified with a completed profile.
- Email signups must verify by a link that opens the website, then return to the
  app and sign in. Password reset also finishes on the website.
- Account deletion: Profile screen, and also the suspended screen. It calls
  `DELETE /api/users/me`.
- Blocking and reporting: on a member's profile. The blocked list and unblock are
  on the Profile screen.
- Accounts with two-factor authentication (admins only) must use the website.
- The app shows a retry screen when a saved session cannot be checked offline.
- Encryption: `ITSAppUsesNonExemptEncryption` is `false` in `Info.plist`.

## Owner must decide

- **iPad on or off.** `TARGETED_DEVICE_FAMILY` is `1,2` today, so iPad is on and
  iPad screenshots will be needed. The Info.plist allows all iPad orientations
  while iPhone is portrait only. Not changed here.
- **Developer account type** (individual or organization) on Apple and Google.
- **Test account** for reviewers, as above.
- **Content rating and age answers.** The code does not enforce these beyond what
  the server checks.
- **Whether to ship with a Sentry DSN**, and which Sentry project.
- **New app icon.** `assets/logo.png` is 227x217 and too small and not square, so
  it needs a new source asset.

## Not in this version

Push notifications and deep links are not implemented. The app declares neither.

## Merged Android permissions

From `build/app/intermediates/merged_manifest/debug` after `flutter build apk
--debug` on 2026-11-03:

| Permission | Added by |
|---|---|
| `INTERNET` | the app |
| `ACCESS_NETWORK_STATE` | plugins (Firebase, Sentry) |
| `com.google.android.providers.gsf.permission.READ_GSERVICES` | Firebase |
| `com.attayyibun.at_tayyibun.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX, internal to the app |

`USE_BIOMETRIC` and `USE_FINGERPRINT` come from flutter_secure_storage. The app
removes them in its manifest because it does not use biometrics.

Sign-up: the server answers sign-up the same way for new and existing emails,
and the app then signs in with the same credentials. If that sign-in fails,
the app shows one message ("Check your email to verify your account, or try
signing in.") whatever the reason.
