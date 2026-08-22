# Firebase Phone Authentication — setup and operations

One verified phone number backs exactly one At-Tayyibun account. Firebase
delivers and checks the SMS code; better-auth remains the only session
authority. This document covers the console work a human has to do, the
environment variables, and how to test the whole thing without spending a
single SMS.

## How it fits together

```
client                       Firebase                 apps/web (better-auth)
──────                       ────────                 ──────────────────────
enter +923001234567  ──────► sends SMS
type 6-digit code    ──────► checks it
                     ◄────── ID token (phone_number claim)
POST /auth/phone-number/verify { phoneNumber, code: <ID token> }
                                                      verifyOTP  → firebase-admin
                                                      creates/links the user
                                                      sets the session cookie
```

The cookie is an ordinary better-auth session cookie, so
`apps/api/src/common/guards/better-auth.guard.ts` and the Flutter
`PersistCookieJar` needed no changes at all.

The bridge is better-auth's built-in `phoneNumber` plugin: supplying its
`verifyOTP` option replaces its own OTP comparison with ours, and everything
downstream (find-or-create user, mint session, set cookie) is its existing,
tested code path. See `apps/web/src/lib/phone-verify.ts` and the plugin config
in `apps/web/src/lib/auth.ts`.

## Console setup

Nothing exists yet, so all of this is first-time work.

1. **Create the project.** Firebase Console → Add project → `at-tayyibun`.
   Register three apps:
   - Web
   - Android, package name `com.attayyibun.at_tayyibun`
   - iOS, bundle id `com.attayyibun.attayyibun`

2. **Enable the provider.** Authentication → Sign-in method → **Phone** → Enable.

3. **Authorized domains.** Authentication → Settings → Authorized domains. Add
   `attayyibun.com`, `localhost`, and any preview domains. A missing entry shows
   up on the web as `auth/invalid-app-credential`, which does not mention
   domains at all.

4. **Android attestation.** Project settings → Your apps → Android → add the
   **SHA-1 *and* SHA-256** fingerprints for both the debug and the release
   keystore (`android/key.properties`), then re-download `google-services.json`
   to `apps/mobile/android/app/`. Without them phone auth silently falls back to
   a reCAPTCHA webview — the classic "works in debug, broken in release" report.

   Play Integrity is the default attestation on `firebase_auth` 6.x and needs a
   Play-recognised build. **A sideloaded release APK will fall back to
   reCAPTCHA**; that is expected during internal testing, not a bug.

5. **iOS attestation.** Upload the **APNs auth key** (.p8, from the Apple
   Developer portal) with its Key ID and Team ID. Silent push is how iOS proves
   app authenticity; without the key every iOS verification degrades to a
   reCAPTCHA webview. Then:
   - put `GoogleService-Info.plist` in `apps/mobile/ios/Runner/` **and add it to
     the Xcode project** (drag into Runner, "Copy items if needed") — a file
     merely present on disk is not linked
   - enable Push Notifications and Background Modes → Remote notifications in
     `ios/Runner/Runner.entitlements`
   - add the plist's `REVERSED_CLIENT_ID` as a URL scheme in
     `ios/Runner/Info.plist` `CFBundleURLTypes`, for the reCAPTCHA fallback

6. **Service account.** Project settings → Service accounts → Generate new
   private key. That JSON gives `FIREBASE_CLIENT_EMAIL` and
   `FIREBASE_PRIVATE_KEY`.

7. **Test phone numbers.** Authentication → Sign-in method → Phone → Phone
   numbers for testing. Add a few pairs, e.g. `+15550001111` / `123456`. These
   are free, unlimited, never send an SMS, and behave identically end to end.
   Add at least one to the App Store and Play review notes.

8. **App Check.** Register reCAPTCHA Enterprise (web), Play Integrity (Android)
   and App Attest (iOS), but leave **enforcement off** at first. Turning it on
   before every surface reports healthy traffic locks out real users. Enforce
   after roughly a week of clean metrics.

9. **Cost controls — do not skip.** Blaze plan is required for meaningful SMS
   volume (the free tier is about 10/day). Set a budget alert, and set
   Authentication → Settings → **SMS region policy** to the countries you
   actually serve. SMS pumping fraud — bot farms verifying premium-rate numbers
   to collect carrier kickbacks — is the number one cost incident with Firebase
   Phone Auth, and region restrictions plus App Check are what stop it. No
   amount of application code will.

## Environment

Web needs both halves (see `apps/web/.env.example`). The API needs **nothing**
— it only validates the better-auth cookie it already validated.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=at-tayyibun.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=at-tayyibun
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=

FIREBASE_PROJECT_ID=at-tayyibun
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@at-tayyibun.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

NEXT_PUBLIC_DEFAULT_COUNTRY_CODE="+92"
```

Keep the quotes and the literal `\n` in the private key; the code unescapes
them. A single-line PEM passed through raw fails with an opaque
"Invalid PEM formatted message".

`NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` is the dialling code assumed for numbers
typed without one. It must agree with the SMS region policy in the console, and
with `DEFAULT_COUNTRY_CODE` in the Flutter build (`--dart-define`).

## Flutter

`flutterfire configure` must be run once before the app will compile — it
generates `apps/mobile/lib/firebase_options.dart`, which `main.dart` imports:

```
dart pub global activate flutterfire_cli
cd apps/mobile
flutterfire configure --project=at-tayyibun
```

That command also drops `google-services.json` and `GoogleService-Info.plist`
into place, though the iOS plist still has to be added to the Xcode project by
hand (step 5).

Android build files also need the Google services Gradle plugin:

```kotlin
// android/settings.gradle.kts, plugins { }
id("com.google.gms.google-services") version "4.4.2" apply false

// android/app/build.gradle.kts, plugins { }
id("com.google.gms.google-services")
```

> The project pins AGP 9.0.1 and Kotlin 2.3.20, which are ahead of what most
> `google-services` plugin releases are validated against. Verify this builds
> before doing the rest of the mobile work — it can eat a day on its own.

## Database

Migration `apps/api/drizzle/0003_phone_identity.sql`:

- `users.email_is_placeholder` — true while the row holds the
  `+<e164>@phone.attayyibun.invalid` address minted for a phone-first signup.
  Gates the profile wizard, and keeps the placeholder out of contact-sharing
  and email campaigns.
- `users.phone_gate_exempt` — backfilled `true` for every pre-existing account,
  so nobody who already signed up is interrupted.
- `users_phone_key` replaced by a **partial** unique index on verified phones
  only. The old index covered every non-null phone, including the unverified
  strings the signup form has written since launch, which let a stranger's typo
  permanently block the real owner from verifying their own number.

`phone_gate_exempt` is deliberately separate from `is_phone_verified`. Marking
legacy rows "verified" would have been simpler, but the plugin looks a user up
by the phone column: whoever really owns a number some legacy account typed
would then sign straight into that account.

Apply with `pnpm --filter api db:migrate`. Before migrating, confirm this
returns zero rows:

```sql
SELECT phone, count(*) FROM users
WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1;
```

## Testing without spending SMS

Firebase test numbers exercise the entire stack for real — the client gets a
genuine `ConfirmationResult`, `getIdToken()` returns a genuinely signed token
with a real `phone_number` claim, and `verifyIdToken` accepts it. Nothing is
stubbed.

1. **Phone-first signup** with a fresh test number → user row created,
   `phone` set, `is_phone_verified = true`,
   `email = ...@phone.attayyibun.invalid`, `email_is_placeholder = true`,
   session cookie present, lands on `/profile/setup`.
2. **Idempotency — the single most important assertion.** Sign out, verify the
   same number again → signs into the *same* user, no second row.
3. **Email required.** Try to leave `/profile/setup` with the email blank →
   blocked. Enter a real one → `users.email` updated,
   `email_is_placeholder = false`, verification mail sent.
4. **Google sign-in** → bounced to `/verify-phone` → verify a free number →
   attached, proceeds.
5. **Collision.** Verify a number that already belongs to another account →
   `PHONE_NUMBER_EXIST` and the "already in use" screen, no data touched.
6. **Grandfathering.** An account created before the migration signs in → never
   sees `/verify-phone`.
7. **Legacy claim release.** Set some user's `phone` by hand with
   `is_phone_verified = false`, then verify that number from a different
   account → must succeed, and the legacy row's `phone` must be nulled.
8. **Cross-service.** With only a phone-verified cookie,
   `GET /api/session/me` returns 200 — proves the bridge without the guard
   having been modified.
9. **Replay.** Capture an ID token and POST `/auth/phone-number/verify` twice →
   the second must fail.
10. **Tampering.** A Google-issued Firebase token is rejected on
    `sign_in_provider`; a valid phone token with a mismatched `phoneNumber` body
    is rejected on the claim comparison.
11. **Rate limit.** 12 rapid verifies → 429.
12. **Mobile.** Android from Play internal testing (not a sideloaded APK) and
    iOS from TestFlight — the only builds that exercise Play Integrity and APNs
    silent-push attestation.
