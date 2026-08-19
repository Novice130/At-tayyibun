# iOS Launch Plan — At-Tayyibun

> Detailed build plan for shipping the existing Flutter app to the iOS App Store.
> Written to be executable end-to-end by someone (or something) with no prior context.

---

## Context

At-Tayyibun is a US-focused Muslim matrimony platform. Three surfaces exist today:

| Surface | Path | State |
|---|---|---|
| Web app (Next.js 15 + better-auth) | `apps/web` | Live at `https://attayyibun.com` |
| API (NestJS + Drizzle + Neon Postgres) | `apps/api` | Live, proxied at `https://attayyibun.com/api/*` |
| Mobile app (Flutter) | `apps/mobile` | Android only — APK v0.1.2+3 shipped, served from `/downloads/at-tayyibun.apk` |

The owner now has an Apple Developer Program membership and wants an iOS app on the
App Store as fast as is safely possible.

**The single most important finding from the codebase survey:** `apps/mobile` has **no
`ios/` directory at all**. `.metadata` lists only `root` and `android` under
`migration.platforms`. The Flutter project was created Android-only. All 23 Dart files
(4,086 lines — auth, browse, requests, profile, theming, routing) are platform-agnostic
and reusable as-is; what is missing is the iOS runner shell plus four App Store
compliance features that do not exist anywhere in the product yet.

**Intended outcome:** a native-feeling iOS build of the existing Flutter app, submitted
and approved on the first review pass, sharing one codebase with the Android app.

---

## Decisions locked with the owner

1. **Extend the existing Flutter app** with an iOS target. No SwiftUI rewrite.
2. **All four App Store blockers are in scope**, including the backend work they need:
   Sign in with Apple, in-app account deletion, block + report users, 18+ age gate.
3. **Photos: no camera/library upload.** The user picks from the **existing preset
   avatar set** the web app already ships (`/avatars/male/male-1..13.jpg`,
   `/avatars/female/female-1..13.jpg`). This means **no `image_picker` dependency and no
   `NSPhotoLibraryUsageDescription` / `NSCameraUsageDescription` in `Info.plist`** —
   a meaningful reduction in review risk for a matrimony app.
4. Plan lives at `docs/ios-launch-plan.md`.

---

## What already exists (reuse, do not rebuild)

Read these before writing any code. They define the conventions the new code must match.

| Concern | File | Notes |
|---|---|---|
| HTTP entry point | `apps/mobile/lib/core/api_client.dart` | Cookie-based session via `PersistCookieJar`. Injects `Origin` on `/auth/*` mutations and `X-Requested-With` on `/api/*` mutations. **Every new call must go through this class.** |
| Endpoints + base URL | `apps/mobile/lib/core/constants.dart` | `kBaseUrl = 'https://attayyibun.com'`; `kGoogleServerClientId` comes from `--dart-define`. |
| Auth state | `apps/mobile/lib/providers.dart` (`AuthController`, `authControllerProvider`) | Riverpod `StateNotifier`. `AuthStatus.{unknown,signedIn,signedOut}`. |
| Auth calls | `apps/mobile/lib/repositories/auth_repository.dart` | `sealed class SignInResult` with `SignInSuccess` / `SignInTwoFactorRequired` / `SignInCancelled`. **Apple sign-in must return the same sealed type.** |
| Routing | `apps/mobile/lib/router.dart` | go_router + `ShellRoute`, redirect gate on `AuthStatus`, `/splash` while unknown. |
| Design tokens | `apps/mobile/lib/core/theme.dart` | Palette lifted verbatim from `apps/web/src/app/globals.css`. Gold `#D4AF37`, dark `#0F0F1A`. |
| Error shape | `apps/mobile/lib/core/api_exception.dart` | `ApiException.fromDio`. |
| Empty / error / loading UI | `apps/mobile/lib/widgets/states.dart` | Reuse — do not hand-roll new empty states. |
| Avatar rendering | `apps/mobile/lib/widgets/profile_avatar.dart` | Currently **SVG-only** (`SvgPicture.network`) because the API returns DiceBear SVG. Must be taught to also render JPG — see Task B4. |
| Preset avatar set (source of truth) | `apps/web/src/app/signup/SignupForm.tsx:12-13` | `MALE_AVATARS` / `FEMALE_AVATARS`, 13 each. |
| Server avatar generation | `apps/api/src/services/avatar.service.ts` | DiceBear `https://api.dicebear.com/9.x`, seeded by `userId`. |
| Browse query | `apps/api/src/modules/profiles/profiles.service.ts:29` (`browseProfiles`) | Takes only `filters` — **no caller identity**, so it cannot exclude blocked users yet. |
| Photo moderation (already built) | `apps/api/src/modules/admin/controllers/admin-photos.controller.ts` | `pending` / `approve` / `reject`. Satisfies half of Guideline 1.2. |
| CSRF middleware | `apps/api/src/common/middleware/origin-check.middleware.ts:48` | Checks **presence only** of `x-requested-with`, not its value. |
| Legal pages | `apps/web/src/app/privacy`, `apps/web/src/app/terms` | Already live. URLs reused in App Store Connect and in-app. |
| better-auth config | `apps/web/src/lib/auth.ts` | `socialProviders.google` at line 203; `account.accountLinking.trustedProviders: ["google"]` at 216; `user.additionalFields` at 336. |
| DB schema | `apps/api/src/db/schema.ts` | `users` at line 155 (has `image: text()`), `profiles` at 327. |
| Migrations | `apps/api/drizzle/` | `0000_ambitious_absorbing_man.sql`, `0001_partial_pending_request_index.sql`, `meta/_journal.json`. Migrations run before server start (commit `a6b07c1`). |

**Toolchain verified present on this machine:** Flutter 3.44.9 (stable, Dart 3.12.2),
Xcode 26.6 (17F113), CocoaPods 1.17.0, Ruby 4.0.6 arm64.

---

## The four blockers, stated precisely

These are not polish. Each one is a documented first-pass rejection for an app of this
category. None of them exist in the codebase today.

| # | App Store Guideline | Requirement | Current state |
|---|---|---|---|
| 1 | **4.8 — Login Services** | If the app offers a third-party login (it offers Google), it must also offer an equivalent privacy-preserving option. Sign in with Apple satisfies this. | `socialProviders` in `apps/web/src/lib/auth.ts` contains **google only**. No `sign_in_with_apple` in `pubspec.yaml`. |
| 2 | **5.1.1(v) — Account Deletion** | An app that supports account creation must let the user initiate account deletion **from inside the app**. | Only `DELETE /admin/users/:id` exists (`apps/api/src/modules/admin/admin.controller.ts:82`) — admin-only. No self-serve path. |
| 3 | **1.2 — User-Generated Content** | Requires all four: content filtering, a report mechanism, the ability to **block** abusive users, and published developer contact info. | Photo moderation exists. **No report endpoint, no block endpoint, no block table.** Free-text `bio` is unfiltered. |
| 4 | **Age rating / 1.1.4** | Matrimony is treated as a dating-adjacent category → 18+ rating and a real age gate. | `profiles.dob` is collected but **no minimum-age check** is enforced anywhere. |

A fifth item, not a guideline but a hard functional dependency: **Apple Private Email
Relay**. Users who choose "Hide My Email" get an `@privaterelay.appleid.com` address.
The product sends transactional email through Resend (`apps/api/src/services/email.service.ts`,
`apps/web/src/lib/auth.ts`). Apple silently drops relayed mail from unregistered sending
domains, so approved-contact-share emails would vanish. See Task A5.

---

# Phase A — Backend and identity groundwork

Do this phase first and deploy it. The iOS client depends on every item here, and the
web app benefits from all of it.

### A1. Apple Developer portal setup (manual, ~30 min)

Perform in `developer.apple.com` → Certificates, Identifiers & Profiles.

1. **App ID.** Identifiers → `+` → App IDs → App.
   - Description: `At-Tayyibun iOS`
   - Bundle ID: **explicit**, `com.attayyibun.attayyibun`
   - ⚠️ Apple bundle IDs permit only `A–Z a–z 0–9 - .` — **underscores are rejected**.
     The Android `applicationId` is `com.attayyibun.at_tayyibun`
     (`apps/mobile/android/app/build.gradle.kts:31`) and **must stay as-is**; the two
     platforms have independent identifiers and diverging here is correct.
   - Capabilities: tick **Sign In with Apple**.
2. **Services ID.** Identifiers → `+` → Services IDs.
   - Identifier: `com.attayyibun.web`
   - Enable Sign In with Apple → Configure → Primary App ID = the App ID above.
   - Domains: `attayyibun.com`. Return URL: `https://attayyibun.com/auth/callback/apple`.
   - This is the value better-auth uses as `clientId`.
3. **Sign in with Apple key.** Keys → `+` → enable Sign In with Apple → Primary App ID.
   - Download the `.p8` **once** (Apple never re-serves it). Record the **Key ID** and
     the **Team ID** (top right of the portal).
4. **Register the app record** in App Store Connect → My Apps → `+` → New App.
   - Platform iOS, name `At-Tayyibun`, primary language English (U.S.),
     bundle ID `com.attayyibun.attayyibun`, SKU `attayyibun-ios-001`.
   - Reserving the name early is the point; metadata comes later in Phase E.

Record all secrets in the project's existing secret store. **Never commit the `.p8`.**
Note the existing memory entry: the Google OAuth **web** client secret is known-leaked
and rotation was deferred until ship. Ship time is now — rotate it during Phase A
alongside adding Apple, and re-inject the new value into both containers.

### A2. Apple client secret generation

Apple's OAuth "client secret" is an ES256 JWT signed with the `.p8`, **max 6-month
validity**. Add a small generator so it can be regenerated without archaeology.

Create `apps/api/scripts/generate-apple-secret.ts`:

```ts
// Regenerates the Apple OAuth client secret JWT. Apple caps these at 6 months,
// so this has to be re-run and the env var updated twice a year.
//   pnpm --filter api tsx scripts/generate-apple-secret.ts
import { SignJWT, importPKCS8 } from "jose";

const TEAM_ID = process.env.APPLE_TEAM_ID!;        // 10 chars, e.g. AB12CD34EF
const KEY_ID = process.env.APPLE_KEY_ID!;          // 10 chars, from the Keys page
const CLIENT_ID = process.env.APPLE_CLIENT_ID!;    // com.attayyibun.web (Services ID)
const P8 = process.env.APPLE_PRIVATE_KEY!;         // full -----BEGIN PRIVATE KEY----- block

const key = await importPKCS8(P8.replace(/\\n/g, "\n"), "ES256");
const now = Math.floor(Date.now() / 1000);

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
  .setIssuer(TEAM_ID)
  .setIssuedAt(now)
  .setExpirationTime(now + 60 * 60 * 24 * 180) // 180d, just under Apple's cap
  .setAudience("https://appleid.apple.com")
  .setSubject(CLIENT_ID)
  .sign(key);

console.log(jwt);
```

`jose` is already an indirect dependency of better-auth; add it explicitly to
`apps/api/package.json` if the import does not resolve.

Add to `.env.example` (values blank) and to both deployed containers:

```
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_CLIENT_ID=com.attayyibun.web
APPLE_PRIVATE_KEY=
APPLE_CLIENT_SECRET=        # output of the script above
APPLE_APP_BUNDLE_ID=com.attayyibun.attayyibun
```

Add a calendar reminder for the 6-month expiry. When it lapses, **all** Apple sign-ins
fail at once with an opaque `invalid_client` — a silent time-bomb worth documenting in
`DEPLOYMENT_LESSONS.md`.

### A3. Wire the Apple provider into better-auth

Edit `apps/web/src/lib/auth.ts`. In `socialProviders` (line ~203), alongside `google`:

```ts
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID as string,
      clientSecret: process.env.APPLE_CLIENT_SECRET as string,
      // Native iOS sign-in presents an ID token whose `aud` is the *app's*
      // bundle id, not the Services ID. Without this, better-auth rejects
      // every native token as an audience mismatch while the web redirect
      // flow keeps working — a confusing split failure.
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID as string,
    },
  },
```

In `account.accountLinking` (line ~216) extend `trustedProviders`:

```ts
      trustedProviders: ["google", "apple"],
```

Apple verifies email ownership, so linking on its assertion is safe and prevents the
duplicate-account class the existing comment describes. Leave
`allowDifferentEmails: false` untouched.

Add `https://appleid.apple.com` to `trustedOrigins` if that option is set in the config.

**Apple-specific gotcha to code around:** Apple returns the user's **name only on the
very first authorization**, never again. If the first attempt fails after Apple's
callback, the name is lost permanently. The iOS client (Task C1) must therefore forward
`givenName`/`familyName` on every attempt, and the server must persist whatever it
receives on the first successful one.

### A4. Self-serve account deletion — `DELETE /api/users/me`

New files under `apps/api/src/modules/users/`:

- `users.module.ts`
- `users.controller.ts`
- `users.service.ts`

Register `UsersModule` in `apps/api/src/app.module.ts` next to the other feature modules.

Controller shape — match the existing style in
`apps/api/src/modules/requests/requests.controller.ts` (Swagger decorators, `@CurrentUser`):

```ts
@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete("me")
  @ApiOperation({ summary: "Permanently delete the caller's own account" })
  @ApiResponse({ status: 200, description: "Account deleted" })
  async deleteMe(@CurrentUser("id") userId: string) {
    return this.usersService.deleteOwnAccount(userId);
  }
}
```

Service requirements — deletion must be **real, immediate and complete**. Apple review
explicitly tests that "delete" is not a disguised deactivation.

1. Delete in FK-safe order inside one transaction: `photos` → `info_requests` (both
   sides) → `skip_reasons` → `messages` → `blocks` → `reports` (as reporter) →
   `profiles` → `two_factor` → `session` → `account` → `users`.
   Several tables already cascade from `users.id` (`profiles_user_id_fkey` is
   `onDelete: "cascade"`); verify each FK in `apps/api/src/db/schema.ts` and rely on the
   cascade where it exists rather than duplicating deletes.
2. Delete the user's objects from GCS via `StorageService` before the DB rows disappear —
   otherwise the paths are unrecoverable and the blobs orphan forever.
3. Write an `audit_logs` row **before** the delete (the FK to `users` will be gone after).
4. **Revoke the Apple token.** Apple requires apps using Sign in with Apple to call
   `https://appleid.apple.com/auth/revoke` on account deletion. Look up the user's
   `account` row where `providerId = 'apple'`, then POST
   `client_id`, `client_secret`, `token` (the stored refresh token),
   `token_type_hint=refresh_token`. Failure to revoke is itself a rejection reason.
5. Return `{ ok: true }` and let the client clear its cookie jar.

**Reports left behind:** rows in `reports` that *target* the deleted user must survive
for moderation history — set `reported_user_id` to `null` (nullable FK,
`onDelete: "set null"`) rather than cascading.

Also expose it on the web app (Profile → Danger Zone) so the two clients stay in step.

### A5. Apple Private Email Relay registration

In developer.apple.com → Services → **Sign in with Apple for Email Communication**, add
the Resend sending domain and every `From:` address used by
`apps/api/src/services/email.service.ts` and `apps/web/src/lib/auth.ts`.

Without this, mail to `@privaterelay.appleid.com` is dropped silently — the
approved-contact-share email, the single highest-value email in the product, would
never arrive for Apple-relay users and the failure is invisible in Resend's dashboard.

### A6. Age gate — enforce 18+

Server-side, in `apps/api/src/modules/profiles/profiles.service.ts` `updateMyProfile`:
reject a `dob` that yields an age below 18 with a `BadRequestException`. Reuse the
existing `calculateAgeFromString` helper in that same file — do not write a second age
calculator.

Client-side, in `apps/mobile/lib/screens/edit_profile_screen.dart`, cap the date picker's
`lastDate` at `DateTime(now.year - 18, now.month, now.day)` so the invalid range is
simply unreachable. Mirror the same rule in `apps/web/src/app/profile/setup/page.tsx`.

---

# Phase B — Block, report, and the avatar fix

### B1. Schema

Add to `apps/api/src/db/schema.ts`, matching the file's existing style (snake_case
column names, `uuid().primaryKey()`, explicit `foreignKey({...})` blocks):

```ts
export const blocks = pgTable("blocks", {
	id: uuid().primaryKey().notNull(),
	blockerId: uuid("blocker_id").notNull(),
	blockedId: uuid("blocked_id").notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' })
		.default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("blocks_pair_key").using("btree",
		table.blockerId.asc().nullsLast().op("uuid_ops"),
		table.blockedId.asc().nullsLast().op("uuid_ops")),
	index("blocks_blocker_idx").using("btree", table.blockerId.asc().nullsLast().op("uuid_ops")),
	index("blocks_blocked_idx").using("btree", table.blockedId.asc().nullsLast().op("uuid_ops")),
	foreignKey({ columns: [table.blockerId], foreignColumns: [users.id],
		name: "blocks_blocker_id_fkey" }).onUpdate("cascade").onDelete("cascade"),
	foreignKey({ columns: [table.blockedId], foreignColumns: [users.id],
		name: "blocks_blocked_id_fkey" }).onUpdate("cascade").onDelete("cascade"),
]);

export const reportStatus = pgEnum("report_status", ["PENDING", "REVIEWED", "DISMISSED", "ACTIONED"]);

export const reports = pgTable("reports", {
	id: uuid().primaryKey().notNull(),
	reporterId: uuid("reporter_id"),          // null once the reporter deletes their account
	reportedUserId: uuid("reported_user_id"), // null once the reported user is deleted
	reason: varchar({ length: 64 }).notNull(),
	details: text(),
	status: reportStatus().default('PENDING').notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { precision: 3, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' })
		.default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("reports_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("reports_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({ columns: [table.reporterId], foreignColumns: [users.id],
		name: "reports_reporter_id_fkey" }).onUpdate("cascade").onDelete("set null"),
	foreignKey({ columns: [table.reportedUserId], foreignColumns: [users.id],
		name: "reports_reported_user_id_fkey" }).onUpdate("cascade").onDelete("set null"),
]);
```

Fixed reason codes (client and server must agree; keep them in
`apps/api/src/common/types/role.ts` next to `PhotoType`):
`FAKE_PROFILE`, `INAPPROPRIATE_CONTENT`, `HARASSMENT`, `SPAM_OR_SCAM`,
`UNDERAGE`, `OTHER`.

Generate the migration with `pnpm --filter api db:generate`, then **read the emitted
SQL before committing it** — `schema.ts` was originally produced by `db:pull`
introspection and drizzle-kit has previously wanted to re-create existing objects.
`0001_partial_pending_request_index.sql` was hand-written for exactly this reason;
follow that precedent if the generated diff is noisy. Confirm the new entry lands in
`apps/api/drizzle/meta/_journal.json`. Migrations run before the server starts, so
deploying the API applies them.

### B2. Endpoints

New `apps/api/src/modules/moderation/` module (`moderation.module.ts`,
`moderation.controller.ts`, `moderation.service.ts`), registered in `app.module.ts`:

| Method | Path | Body | Behaviour |
|---|---|---|---|
| `POST` | `/api/blocks` | `{ targetPublicId }` | Idempotent insert (`onConflictDoNothing` on the unique pair). Also hard-cancels any pending `info_requests` in **either** direction between the two users. |
| `DELETE` | `/api/blocks/:targetPublicId` | — | Removes the row. |
| `GET` | `/api/blocks` | — | The caller's block list, for a Settings screen. |
| `POST` | `/api/reports` | `{ targetPublicId, reason, details? }` | Inserts a `PENDING` report. Rate-limit to 10/day/user. Emails the admin address via the existing `EmailService`. |

Admin side, mirroring `admin-photos.controller.ts`:
`GET /admin/reports?status=PENDING`, `POST /admin/reports/:id/resolve`
(`{ action: 'DISMISS' | 'SUSPEND_USER' | 'DELETE_USER', note? }`).

**Guideline 1.2 requires acting on reports within 24 hours.** A queue nobody watches is
worse than none — wire the report notification email to an address that is actually
monitored, and say so in the App Review notes.

### B3. Make blocks actually hide people

`browseProfiles(filters)` in `apps/api/src/modules/profiles/profiles.service.ts:29`
currently receives no caller identity. Change the signature to
`browseProfiles(filters, viewerId: string)` and thread `viewerId` from
`profiles.controller.ts` (`@Get()`), which already has `@CurrentUser`.

Add to the `conds` array:

```ts
    // Blocking is symmetric: neither party sees the other again.
    conds.push(sql`${profiles.userId} <> ${viewerId}`);
    conds.push(sql`NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = ${profiles.userId})
         OR (b.blocker_id = ${profiles.userId} AND b.blocked_id = ${viewerId})
    )`);
```

Note the first line also fixes a pre-existing bug: **browse currently returns the
caller's own profile.** Apply the same `NOT EXISTS` guard to
`GET /api/profiles/:publicId` (return 404, not 403 — leaking "you are blocked" is worse
UX and worse privacy) and to `POST /api/requests`.

### B4. Preset avatar selection — the "existing photos" feature

**The bug this exposes.** The web signup wizard has an avatar step
(`apps/web/src/app/signup/SignupForm.tsx:532`) that writes a preset path into
`user.image` via better-auth. But `browseProfiles` unconditionally overwrites it:

```ts
avatarUrl: this.avatarService.getAvatarDisplay(profile.userId, profile.gender),
```

So every browse card shows a DiceBear SVG seeded from `userId`, and **the avatar the
user chose is never displayed to anyone.** Fix this first, or the iOS picker will appear
to do nothing.

In `apps/api/src/modules/profiles/profiles.service.ts`, at both call sites (lines 101
and 132), prefer the stored image and fall back to DiceBear:

```ts
avatarUrl: user.image?.trim()
  ? user.image
  : this.avatarService.getAvatarDisplay(profile.userId, profile.gender),
```

`users.image` is already selected in the detail query; add `image: users.image` to the
`user` projection in `browseProfiles`.

**Serve the presets from a stable URL.** They currently live in the web app's
`public/avatars/`. Store the **absolute** URL (`https://attayyibun.com/avatars/male/male-3.jpg`)
in `users.image` so the mobile client needs no base-URL logic — and normalise any
existing relative values (`/avatars/...`) to absolute in a one-line data migration.

**Flutter side:**

1. `apps/mobile/lib/core/constants.dart` — add the catalogue, mirroring the web:

```dart
/// The preset avatar set, mirrored from apps/web/src/app/signup/SignupForm.tsx.
/// Real photos are never displayed publicly — a chosen cartoon avatar is the
/// only image the product shows, which is also why the iOS app needs no photo
/// library permission.
List<String> presetAvatars(String gender) {
  final folder = gender.toUpperCase() == 'MALE' ? 'male' : 'female';
  return List.generate(13, (i) => '$kBaseUrl/avatars/$folder/$folder-${i + 1}.jpg');
}
```

Keeping the count as a literal `13` in two places is a real duplication risk. If a
15-minute detour is acceptable, expose `GET /api/avatars?gender=MALE` from the API and
have both clients read it.

2. `apps/mobile/lib/widgets/profile_avatar.dart` — it uses `SvgPicture.network`
   unconditionally. The presets are **JPG**. Branch on the extension:

```dart
    final isSvg = url.endsWith('.svg') || url.contains('api.dicebear.com');
    final image = isSvg
        ? SvgPicture.network(url, width: size, height: size, fit: BoxFit.cover,
            placeholderBuilder: (_) => placeholder,
            errorBuilder: (_, _, _) => placeholder)
        : Image.network(url, width: size, height: size, fit: BoxFit.cover,
            errorBuilder: (_, _, _) => placeholder);
```

`Image.network` has no `placeholderBuilder`; use `frameBuilder` if a fade-in is wanted.

3. `apps/mobile/lib/repositories/auth_repository.dart` — add:

```dart
  /// Persists the chosen preset avatar. better-auth exposes this as a POST on
  /// the auth base path, so it goes through the /auth Origin-header branch of
  /// ApiClient rather than the /api X-Requested-With branch.
  Future<void> updateAvatar(String imageUrl) async {
    await _api.post<dynamic>('/auth/update-user', body: {'image': imageUrl});
  }
```

4. New `apps/mobile/lib/screens/avatar_picker_screen.dart` — a 3-column
   `GridView.builder` of the 13 presets for the profile's gender, gold ring +
   check badge on the selected one, "Save" in the app bar. Route
   `/profile/avatar` on `_rootKey` (full-screen, outside the shell), matching how
   `/profile/edit` is already registered in `apps/mobile/lib/router.dart`.

5. Entry points: an "Change photo" button over the avatar in
   `my_profile_screen.dart`, and a step in `signup_screen.dart` after gender is known,
   so mobile signups reach parity with web. **Today the mobile signup collects no avatar
   at all** — every mobile-created account falls back to the initial-letter placeholder.

6. Invalidate `myProfileProvider` after a successful save so the UI refreshes.

---

# Phase C — Generate and configure the iOS target

### C1. Create the `ios/` directory

From `apps/mobile`:

```
flutter create --platforms=ios --org com.attayyibun --project-name at_tayyibun .
```

This is additive — it creates `ios/` and touches nothing under `lib/` or `android/`.
Confirm with `git status` before proceeding; if it has modified Dart or Gradle files,
revert those hunks.

`.metadata` gains an `ios` entry under `migration.platforms`. Commit that.

Then run `cd ios && pod install`.

**Immediately fix the bundle identifier.** Flutter derives it from the project name and
will produce something like `com.attayyibun.atTayyibun`. Open
`ios/Runner.xcodeproj` in Xcode → Runner target → Signing & Capabilities, and set
`PRODUCT_BUNDLE_IDENTIFIER` to `com.attayyibun.attayyibun` for **all three**
configurations (Debug, Release, Profile). Verify with:

```
grep -c "com.attayyibun.attayyibun" ios/Runner.xcodeproj/project.pbxproj   # expect 3
```

Note `.metadata` lists `ios/Runner.xcodeproj/project.pbxproj` under `unmanaged_files`,
so `flutter migrate` will leave hand edits alone.

Also in Signing & Capabilities: select the Team, leave **Automatically manage signing**
on, and add the **Sign in with Apple** capability (this writes
`ios/Runner/Runner.entitlements` with `com.apple.developer.applesignin = [Default]` —
commit that file).

### C2. `ios/Runner/Info.plist`

Add or confirm:

```xml
<key>CFBundleDisplayName</key>
<string>At-Tayyibun</string>

<key>CFBundleName</key>
<string>At-Tayyibun</string>

<!-- Skips the export-compliance question on every single upload. The app uses
     only HTTPS, which is exempt under the standard encryption exemption. -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<!-- Google Sign-In. GIDClientID is the iOS OAuth client id, which is a
     DIFFERENT credential from the web client id passed as serverClientId.
     The reversed form is the URL scheme Google's SDK redirects back on. -->
<key>GIDClientID</key>
<string>PASTE_IOS_CLIENT_ID.apps.googleusercontent.com</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.PASTE_IOS_CLIENT_ID</string>
    </array>
  </dict>
</array>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

**Deliberately absent:** `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`,
`NSLocationWhenInUseUsageDescription`, `NSContactsUsageDescription`. The app touches
none of those. Adding an unused permission string invites a "purpose string for a
capability the app does not use" rejection.

`NSAppTransportSecurity` is also deliberately absent — the default (HTTPS-only) is
correct, and any ATS exception must be justified to review.

**New Google iOS OAuth client:** in Google Cloud Console → Credentials → Create OAuth
client ID → **iOS**, bundle ID `com.attayyibun.attayyibun`. The **web** client id stays
the `serverClientId` value passed via `--dart-define`, because
`apps/web/src/lib/auth.ts` verifies the token audience against the web client
(see the long comment at `apps/mobile/lib/core/constants.dart:35`).

### C3. Icons and launch screen

`apps/mobile/pubspec.yaml` currently has `ios: false`. Change to:

```yaml
flutter_launcher_icons:
  android: true
  ios: true
  remove_alpha_ios: true       # App Store rejects icons with an alpha channel
  image_path: "assets/logo.png"
  adaptive_icon_background: "#0F0F1A"
  adaptive_icon_foreground: "assets/logo.png"
```

Run `dart run flutter_launcher_icons`. Then verify no alpha survived:

```
sips -g hasAlpha ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png
```

A 1024pt icon with alpha is a **silent upload rejection** from App Store Connect that
arrives by email minutes after a seemingly successful `flutter build ipa` — a classic
half-day loss.

Launch screen: edit `ios/Runner/Base.lproj/LaunchScreen.storyboard` to a solid
`#0F0F1A` background with the centred logo, so it flows into the existing `_SplashScreen`
in `apps/mobile/lib/router.dart:74` rather than flashing white first.

### C4. Client identity header

`apps/mobile/lib/core/api_client.dart:56` hardcodes
`options.headers['X-Requested-With'] = 'attayyibun-android'`. The middleware checks
presence only, so iOS works unchanged — but the value is now a lie. Change it to
`'attayyibun-mobile'`. No server change needed
(`apps/api/src/common/middleware/origin-check.middleware.ts:48`).

---

# Phase D — Flutter feature work

### D1. Sign in with Apple

`pubspec.yaml`: add `sign_in_with_apple: ^7.0.1` (verify latest on pub.dev at
implementation time; require ≥6.x for the `WebAuthenticationOptions`-free native path).

`apps/mobile/lib/repositories/auth_repository.dart` — new method returning the **same
sealed `SignInResult`** as `signInWithGoogle`, so `AuthController.signIn*` needs no new
branching:

```dart
  /// Native Sign in with Apple.
  ///
  /// Mirrors the Google path deliberately: Apple's native sheet hands back an
  /// identity token, we POST it to better-auth, and the session cookie comes
  /// back on that response straight into our jar. A browser redirect flow
  /// would drop the cookie in Safari instead of the app.
  Future<SignInResult> signInWithApple() async {
    final rawNonce = _generateNonce();
    final AuthorizationCredentialAppleID cred;
    try {
      cred = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: sha256.convert(utf8.encode(rawNonce)).toString(),
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        return const SignInCancelled();
      }
      throw ApiException(
        message: 'Apple sign-in failed. Please try again.',
        statusCode: 0,
      );
    }

    final idToken = cred.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw ApiException(
        message: 'Apple did not return an identity token.',
        statusCode: 0,
      );
    }

    // Apple returns the name ONLY on the first ever authorization for this
    // Apple ID + app pair. Send it every time; the server keeps the first
    // non-empty value it sees. Drop it and the name is unrecoverable.
    final given = cred.givenName ?? '';
    final family = cred.familyName ?? '';
    final name = [given, family].where((s) => s.isNotEmpty).join(' ');

    final data = await _api.post<Map<String, dynamic>>(
      '/auth/sign-in/social',
      body: {
        'provider': 'apple',
        'idToken': {'token': idToken, 'nonce': rawNonce},
        if (name.isNotEmpty) 'name': name,
      },
    );

    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    return SignInSuccess(AppUser.fromJson(user ?? const {}));
  }
```

`_generateNonce()` — 32 chars from `Random.secure()` over
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._`.
The **raw** nonce goes to the server; the **SHA-256** of it goes to Apple. Swapping
them yields a nonce-mismatch rejection that is genuinely hard to read from the error.
Add `crypto: ^3.0.6` to `pubspec.yaml`.

`AuthController` in `providers.dart` — add `signInWithApple()` mirroring
`signInWithGoogle()` exactly.

`login_screen.dart` and `signup_screen.dart` — add the Apple button. Guideline 4.8 and
Apple's Human Interface Guidelines both constrain its presentation:

- Show it **only on iOS**: `if (Theme.of(context).platform == TargetPlatform.iOS)`.
- It must be **no less prominent** than the Google button — place it **above** Google.
- Use the official black-fill style, `SignInWithAppleButton` from the package, corner
  radius 12 to match `theme.dart`'s `filledButtonTheme`.
- Label exactly "Sign in with Apple" / "Sign up with Apple". Apple rejects reworded labels.
- Also honour `signOut()`: unlike Google there is no SDK sign-out to call, so nothing to
  add in `AuthRepository.signOut` beyond what is there.

### D2. Delete account

`apps/mobile/lib/repositories/auth_repository.dart`:

```dart
  Future<void> deleteAccount() async {
    await _api.delete<dynamic>('/api/users/me');
    await _api.clearCookies();
  }
```

`AuthController.deleteAccount()` calls it then sets
`state = const AuthState(status: AuthStatus.signedOut)`; the router redirect in
`router.dart` then bounces to `/login` on its own.

UI in `my_profile_screen.dart` — a "Delete account" entry in a visually separated
danger section (error colour, bottom of the screen). Two-step confirmation:

1. `showDialog` explaining, in plain words, that this is permanent, immediate, and
   removes the profile, photos, and all requests.
2. A second dialog requiring the user to type `DELETE` to enable the confirm button.

Deletion must be reachable in **at most two taps from a persistent tab** — reviewers
look for a buried flow and reject it under 5.1.1(v). Profile tab → Delete account is one
tap and satisfies this comfortably.

Also add an in-app link to `https://attayyibun.com/privacy` and `/terms` in the same
screen (Guideline 1.2 requires published contact info; 5.1.1 wants an accessible
privacy policy). Open in Safari via `url_launcher`, or as a `WebView` — Safari is
simpler and adds no dependency risk.

### D3. Block and report

New `apps/mobile/lib/repositories/moderation_repository.dart`:

```dart
class ModerationRepository {
  ModerationRepository(this._api);
  final ApiClient _api;

  Future<void> block(String targetPublicId) =>
      _api.post<dynamic>('/api/blocks', body: {'targetPublicId': targetPublicId});

  Future<void> unblock(String targetPublicId) =>
      _api.delete<dynamic>('/api/blocks/$targetPublicId');

  Future<void> report(String targetPublicId, {required String reason, String? details}) =>
      _api.post<dynamic>('/api/reports', body: {
        'targetPublicId': targetPublicId,
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      });
}
```

Register `moderationRepositoryProvider` in `providers.dart` alongside the existing three.

UI:

- `profile_detail_screen.dart` — an overflow (`⋮`) app-bar menu with **Block** and
  **Report**. This is the screen a reviewer will look at.
- Block → confirm sheet → on success, pop back to browse, invalidate the browse
  provider, and show a snackbar. The person must visibly disappear from the list.
- Report → modal sheet with the six fixed reasons as radio tiles plus an optional
  details `TextField` (max 500 chars). On success, offer "Also block this person".
- `requests_screen.dart` — the same two actions on each request tile, since abuse is
  most likely to surface after contact is shared.
- `my_profile_screen.dart` — a "Blocked accounts" list backed by `GET /api/blocks`,
  with unblock. Not strictly required by 1.2, but reviewers do check that a block can be
  undone.

### D4. EULA acknowledgement

Guideline 1.2 for UGC apps wants an agreement stating there is **zero tolerance for
objectionable content or abusive users**. Add a checkbox on `signup_screen.dart`:

> I agree to the [Terms of Service] and [Privacy Policy], and I understand that
> At-Tayyibun has zero tolerance for objectionable content or abusive behaviour.

The submit button stays disabled until it is ticked. Both links open the existing
`https://attayyibun.com/terms` and `/privacy` pages. Record acceptance server-side
(a `terms_accepted_at` column on `users`) so it can be evidenced later.

### D5. iOS-native feel

The app is Material-themed (`theme.dart`) and that is fine — Apple does not require
Cupertino widgets. Target the things that read as *wrong* on iOS rather than a
wholesale restyle:

1. **Back-swipe.** Material page transitions on iOS lose the interactive edge swipe.
   Set a `pageTransitionsTheme` with `CupertinoPageTransitionsBuilder()` for
   `TargetPlatform.iOS` in `_build()` in `theme.dart`.
2. **Typography.** `theme.dart:148` hardcodes
   `Typography.material2021(platform: TargetPlatform.android)`. Pass the real platform so
   iOS gets SF-metric text styles.
3. **Scroll physics.** `MaterialApp.router` handles this via the platform, but verify
   the browse list bounces rather than glows.
4. **Bottom nav.** `shell_screen.dart` uses Material 3 `NavigationBar`. It is acceptable,
   but a `CupertinoTabBar`-style variant on iOS is a cheap, high-impact difference.
   Keep the pending-count `Badge` behaviour identical either way.
5. **Safe areas.** Test on a device with a Dynamic Island — the app bar and bottom nav
   must not collide with it. `Scaffold` handles most of it; the custom splash in
   `router.dart` needs checking.
6. **Haptics.** `HapticFeedback.selectionClick()` on tab switch and on sending a request.
7. **Dark mode.** `themeMode: ThemeMode.system` is already set and the dark palette
   exists. Verify every new screen (avatar picker, report sheet, danger zone) in both.
8. **Dynamic Type.** Do not clamp `textScaler`. Verify the browse card and the request
   tile survive the largest accessibility text size without overflow — this is the most
   common place Flutter apps break on iOS.

---

# Phase E — Build, upload, submit

### E1. Local build

```
cd apps/mobile
flutter clean
flutter pub get
cd ios && pod install && cd ..

flutter build ipa --release \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>.apps.googleusercontent.com
```

The `--dart-define` is **mandatory**. `kGoogleServerClientId` is
`String.fromEnvironment` (`constants.dart:44`) and defaults to empty, in which case
`signInWithGoogle` throws "Google sign-in is not configured in this build" — a bug that
only manifests in the shipped artifact. `DEPLOYMENT_LESSONS.md` already records the
equivalent Android trap.

Output: `build/ios/ipa/at_tayyibun.ipa`.

Unlike the Android build, no `--target-platform` narrowing is needed; App Store Connect
thins the binary per-device automatically.

### E2. Upload

Easiest reliable path: open **Transporter** (Mac App Store), drag in the `.ipa`, Deliver.

Or from Xcode: `open ios/Runner.xcworkspace` → Product → Archive → Distribute App →
App Store Connect.

Processing takes 5–30 minutes. Watch for the automated rejection email — icon alpha
channel and missing `ITSAppUsesNonExemptEncryption` are the two that bite here, and both
are pre-empted in C2/C3.

### E3. App Store Connect metadata

| Field | Value |
|---|---|
| Name | `At-Tayyibun` |
| Subtitle | `Muslim Matrimony` (30 char limit) |
| Category | Primary: Lifestyle. Secondary: Social Networking |
| Age rating | **18+**. Apple's tiers are 4+/9+/13+/16+/18+; answer the questionnaire's dating/relationship questions honestly — understating this is a guaranteed rejection and a post-launch removal risk |
| Privacy Policy URL | `https://attayyibun.com/privacy` |
| Support URL | `https://attayyibun.com/contact` (the page exists) |
| Copyright | `2026 At-Tayyibun` |

**Screenshots.** Required: 6.9" iPhone (1320×2868 or 1290×2796). Apple auto-scales down
for smaller devices, so one set is enough. Capture 5–6 from the simulator: browse grid,
profile detail, request flow, requests inbox, own profile, avatar picker. Use the
**demo account's** data — never a real member's profile.

**App Privacy ("nutrition labels").** Declare honestly, from what the code actually
collects:

| Data | Linked to user | Purpose |
|---|---|---|
| Email, name, phone | Yes | App functionality |
| Date of birth (age) | Yes | App functionality |
| Coarse location (city/state) | Yes | App functionality |
| User content (bio, biodata) | Yes | App functionality |
| Photos (chosen preset avatar) | Yes | App functionality |
| User ID | Yes | App functionality |

**Used for tracking: No.** No SDK in `pubspec.yaml` does cross-app tracking, so no
`NSUserTrackingUsageDescription` and no ATT prompt.

**App Review Information — the highest-leverage field.** The entire app is behind a
login wall, so without this it is rejected in hours under 2.1 as "unable to review".

- Demo account email + password, **email pre-verified** (`requireEmailVerification: true`
  is set in `apps/web/src/lib/auth.ts`, so an unverified demo account cannot sign in at
  all).
- The demo profile must be **complete** (`profileComplete = true`) or Browse returns
  nothing and the app looks broken.
- Seed **at least one pending incoming request and one approved one** so the Requests tab
  and the contact-share flow are both demonstrable. `apps/api/src/db/seed.ts` is the
  natural place.
- 2FA is admin-only, so the demo account must **not** be an admin.
- Notes text, roughly:

> At-Tayyibun is a marriage-focused matrimony service for Muslim adults (18+) in the US.
> Real photographs are never displayed publicly — members choose from a fixed set of
> illustrated avatars, so the app requests no camera or photo library access.
> Contact details are shared only after an explicit two-sided approval.
> Moderation: report and block are available from the ⋮ menu on any profile and on any
> request. Reports are emailed to <monitored address> and actioned within 24 hours.
> Account deletion: Profile tab → Delete account (two-step confirmation, immediate and
> permanent).
> Sign in with Apple is offered above Google on both the sign-in and sign-up screens.

### E4. Submit

Pricing: Free. Availability: United States (the product is US-focused —
`kUsStates` in `constants.dart` is US-only and the `implementation_plan.md` assumptions
say so). Adding more territories later is a metadata-only change.

Release: **Manually release this version.** Do not auto-release — it buys a window to
sanity-check the live build before members see it.

---

# Phase F — Rejection playbook

Expect at least one round. Anticipated reasons and the prepared answer:

| Reason | Prepared response |
|---|---|
| 2.1 — cannot sign in | Re-check demo credentials work on a fresh device *right now*; confirm the account is email-verified and `profileComplete`. |
| 4.8 — login services | Screenshot showing Sign in with Apple above Google. |
| 5.1.1(v) — deletion | Screen recording: Profile tab → Delete account → confirm → account gone. |
| 1.2 — UGC | Point to the ⋮ menu on profile detail and on request tiles; state the 24-hour SLA and the monitored address; note the pre-existing photo moderation queue. |
| 1.1.4/2.3.x — age | Point to the 18+ rating, the server-side DOB rejection (Task A6), and the picker cap. |
| 3.1.1 — IAP | If asked about `membershipTier`: the app **sells nothing in-app**. Confirm no purchase UI exists anywhere in `apps/mobile/lib`. If a paid tier is ever surfaced in the app it must go through StoreKit — keep it out of v1. |
| 4.2 — minimum functionality | Argue native implementation (Flutter, not a web view) and the offline-capable session model. |

Reply through Resolution Center; do not resubmit a new binary for a metadata-fixable
issue — it restarts the queue for nothing.

---

## Verification

Run in order. Do not proceed past a failing step.

**Backend (Phase A/B), against a local API:**

```
pnpm --filter api db:generate     # inspect the emitted SQL before committing
pnpm --filter api db:migrate
pnpm --filter api test
pnpm --filter api start:dev
```

- `curl -i -X POST $API/api/blocks -H 'X-Requested-With: attayyibun-mobile' -b "<session>" -d '{"targetPublicId":"..."}'`
  → 201, then `GET /api/profiles` no longer contains that `publicId`, in **both**
  directions.
- `GET /api/profiles` no longer returns the caller's own profile.
- `POST /api/reports` with a bad `reason` → 400. Ten in a day → 429 on the eleventh.
- `PUT /api/profiles/me` with a `dob` under 18 → 400.
- `DELETE /api/users/me` → 200; re-signing in with the same credentials fails; the
  `users` row, `profiles` row, and GCS objects are all gone; the `audit_logs` row remains.
- Browse `avatarUrl` equals the chosen preset for a user who has one, and a DiceBear URL
  for one who does not.

**Flutter:**

```
cd apps/mobile
flutter analyze          # must be clean; the repo lints with flutter_lints ^6
flutter test
flutter build ios --debug --simulator --dart-define=GOOGLE_SERVER_CLIENT_ID=...
flutter run -d "iPhone 17 Pro" --dart-define=GOOGLE_SERVER_CLIENT_ID=...
```

Manual pass on **simulator** (UI, layout, dark mode, Dynamic Type) and on a **physical
device** (Google Sign-In, Apple Sign-In, and cookie persistence across a cold restart —
the simulator's keychain and cookie behaviour differ enough to hide real bugs):

1. Cold launch signed-out → splash → login.
2. Sign in with Apple, first time ever on that Apple ID → name captured → lands on browse.
3. Force-quit, relaunch → still signed in (proves `PersistCookieJar` works against the
   iOS app-support directory).
4. Sign in with Google on iOS → succeeds (proves the new iOS OAuth client + reversed URL
   scheme are right).
5. Browse → scroll to page 2 → open a profile → send a request.
6. Report that profile → block them → they vanish from browse.
7. Profile → change avatar → pick a preset → back → the new avatar shows in the browse
   card and on the profile.
8. Profile → delete account → confirm twice → back to login; the credentials no longer work.
9. Rotate to landscape (should stay portrait-locked), test largest Dynamic Type, test
   dark mode, test with the device offline (should show the existing error states from
   `widgets/states.dart`, not a crash).

**Release build:** repeat 1–8 against `flutter build ipa` output installed via TestFlight
internal testing. This is the only build where a missing `--dart-define` or a signing
problem actually surfaces.

---

## Task checklist

**Phase A — backend groundwork**
- [ ] A1 Apple App ID, Services ID, key, App Store Connect record
- [ ] A2 `generate-apple-secret.ts` + env vars in both containers
- [ ] A2b Rotate the leaked Google web client secret (deferred item, now due)
- [ ] A3 Apple provider in `apps/web/src/lib/auth.ts`
- [ ] A4 `DELETE /api/users/me` + Apple token revocation + web Danger Zone
- [ ] A5 Apple Private Email Relay domain registration
- [ ] A6 18+ enforcement (server, mobile, web)

**Phase B — moderation + avatars**
- [ ] B1 `blocks` / `reports` tables + migration
- [ ] B2 Block/report endpoints + admin queue + notification email
- [ ] B3 Thread `viewerId` through `browseProfiles`; exclude blocked and self
- [ ] B4 Prefer `users.image` over DiceBear; JPG support in `ProfileAvatar`; preset picker screen

**Phase C — iOS target**
- [ ] C1 `flutter create --platforms=ios`; bundle id `com.attayyibun.attayyibun`; signing; Sign in with Apple capability
- [ ] C2 `Info.plist` (Google client, `ITSAppUsesNonExemptEncryption`, portrait, display name)
- [ ] C3 Icons with `remove_alpha_ios`; branded launch screen
- [ ] C4 `X-Requested-With` → `attayyibun-mobile`

**Phase D — Flutter features**
- [ ] D1 Sign in with Apple (repository, controller, buttons on login + signup)
- [ ] D2 Delete account (repository, two-step UI, privacy/terms links)
- [ ] D3 Block + report (repository, profile detail menu, request tiles, blocked list)
- [ ] D4 EULA acknowledgement on signup + `terms_accepted_at`
- [ ] D5 iOS feel (page transitions, typography platform, haptics, safe areas, Dynamic Type)

**Phase E — ship**
- [ ] E1 `flutter build ipa` with the `--dart-define`
- [ ] E2 Upload via Transporter
- [ ] E3 Metadata, screenshots, privacy labels, **demo account + review notes**
- [ ] E4 Submit, manual release

**After approval**
- [ ] Add an App Store badge to `apps/web/src/app/download/page.tsx` (currently APK-only,
      `APK_PATH` at line 8)
- [ ] Record the shipped version + build flags in `docs/open-issues-*.md`, matching the
      convention used for APK v0.1.2+3
- [ ] Bump `version:` in `pubspec.yaml` — iOS build numbers must strictly increase per
      upload, and the shared `0.1.2+3` is already consumed by Android
