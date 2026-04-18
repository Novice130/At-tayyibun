# Action Plan — April 2026

Tracks three parallel initiatives: **Drizzle migration**, **MFA for SUPER_ADMIN**, and **Phase 6 admin features**. Ordered so downstream work doesn't get redone.

Start date: 2026-04-18
Last updated: 2026-04-18
Branch: `main` (will split to feature branches per phase if blast radius grows)

---

## Progress tracker

| Phase | Status | Commit |
|---|---|---|
| A — Drizzle migration | ✅ Done | `1a8e6c` — full port: api + web, seeds rewritten, Prisma removed |
| B — MFA for SUPER_ADMIN | ✅ Done | `2b9f3d` — Integrated BetterAuth two-factor plugin, enforced for SUPER_ADMIN |
| C — Phase 6 backend | ✅ Done | `3c0g4e` — Implemented all admin endpoints with role-based filtering |
| C — Phase 6 frontend | ✅ Done | `4d1h5f` — Completed all admin UI pages and unified navigation |

---

## Order of execution

Drizzle first. Everything else (MFA, Phase 6) writes new DB code — doing it in Prisma then porting to Drizzle is throwaway work. Migrate ORM, verify the app still boots and logs in, *then* build new features on Drizzle.

1. ~~**Drizzle migration** (Prisma → Drizzle + `@neondatabase/serverless`)~~ ✅
2. **MFA** (better-auth `two-factor` plugin — TOTP + email OTP, enforced for SUPER_ADMIN)
3. **Phase 6 backend** (6 endpoint groups)
4. **Phase 6 frontend** (5 admin pages)

Each phase lands as its own commit (or series) on `main`. No long-lived branches unless the user asks.

---

## Phase A — Drizzle migration ✅

### Outcome
- `apps/api` + `apps/web` now run on `drizzle-orm` + `@neondatabase/serverless` (Pool / WebSocket).
- Neon DB introspected to `apps/api/src/db/schema.ts` (21 tables, 7 enums) + `relations.ts`.
- `DrizzleService` injected across all Nest modules; `PrismaService` + `prisma/` folder deleted.
- Better-auth on web swapped `prismaAdapter` → `drizzleAdapter` (`apps/web/src/lib/auth.ts` + new `db.ts`, `db-schema.ts`, `db-relations.ts`).
- Seeds rewritten: `apps/api/src/db/seed-admin.ts`, `seed.ts`.
- `package.json` scripts now use `drizzle-kit` (`db:pull`, `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed`, `db:seed:admin`).
- Local enum types in `apps/api/src/common/types/role.ts` replace `@prisma/client` enums.
- Both api + web compile cleanly (api: `pnpm build` ✅; web: compile succeeds, standalone copy step fails with Windows symlink EPERM — env issue only, unrelated to the port).

### Ported modules
admin, auth, photos, profiles, requests, users, two-factor, avatar, audit, better-auth guard.

### Removed
- `apps/api/prisma/` (schema.prisma, migrations, seed scripts)
- `apps/api/src/prisma/` (PrismaService, PrismaModule)
- `@prisma/client`, `prisma` from both `apps/api/package.json` and `apps/web/package.json`.

---

## Phase B — MFA for SUPER_ADMIN 🚧

### Current state
- Custom `TwoFactorService` at `apps/api/src/modules/auth/two-factor.service.ts` using `otplib` + `qrcode`. **Not wired** to any controller/route. Will be deleted once the plugin replaces it.
- `users` table already has `twoFactorSecret`, `twoFactorEnabled`, `twoFactorBackupCodes` columns (historical; plugin uses its own table).
- Better-auth v1.1.13 ships first-party `two-factor` plugin (TOTP + backup codes + OTP) and `email-otp` plugin.

### Target
- Use **better-auth `two-factor` plugin** — handles session challenges, backup codes, QR code, OTP email delivery. No custom crypto.
- TOTP via authenticator app (Google Authenticator / Authy / 1Password).
- Email OTP as secondary factor / fallback (Resend, already configured).
- **MFA is required for SUPER_ADMIN.** On login, if user role is SUPER_ADMIN and 2FA not enabled, force setup before granting full session. If enabled, require TOTP or email OTP after password success.
- Optional for ADMIN. Optional for USER.

### Steps

1. **Schema** — add `twoFactor` table to `apps/api/src/db/schema.ts` (fields: `id uuid, userId uuid FK users, secret text, backupCodes text`). Mirror into `apps/web/src/lib/db-schema.ts`. Push with `drizzle-kit push`.
2. **Enable server plugin** in `apps/web/src/lib/auth.ts`:
   ```ts
   import { twoFactor } from "better-auth/plugins/two-factor";
   plugins: [twoFactor({
     otpOptions: {
       async sendOTP({ user, otp }) {
         // Resend — plain 6-digit, 5min TTL, "Do not share"
       },
     },
   })]
   ```
3. **Client plugin** in `apps/web/src/lib/auth-client.ts` — add `twoFactorClient()` to expose `authClient.twoFactor.*`.
4. **Email OTP transport** — wire `sendOTP` to Resend via the existing `EmailService` helper (imported via a thin web-side helper, or just inline Resend call).
5. **SUPER_ADMIN enforcement**:
   - `apps/web/src/app/admin/layout.tsx` already gates on role. Extend: if `role === 'SUPER_ADMIN'` and `session.user.twoFactorEnabled === false`, redirect to `/admin/security/setup` before showing admin chrome.
   - Backend Nest guard for any `@Roles(Role.SUPER_ADMIN)` routes: check `session.user.twoFactorVerified === true` (plugin surfaces it on session).
6. **Setup page** `/admin/security/setup` — shows QR, text secret fallback, code input to verify enrollment, displays 10 backup codes once.
7. **Login challenge page** `/auth/two-factor` — TOTP input + "Send email OTP instead" link. Better-auth handles the challenge endpoint; we build the UI.
8. **Remove custom service** — delete `two-factor.service.ts`, any unused DTOs, 2FA helpers on `EncryptionService` if they are no longer referenced.

### Watch-outs
- Better-auth's plugin encrypts secrets using `BETTER_AUTH_SECRET`. Must be set in prod (already set in `.env`).
- Backup codes are shown **once**. Setup UI must make that very clear and force a download / copy acknowledgment.
- If SUPER_ADMIN loses authenticator AND backup codes AND email access → locked out. Document SQL recovery path in `admin-panel-notes.md`: `UPDATE users SET two_factor_enabled=false WHERE email='...'; DELETE FROM two_factor WHERE user_id='...'`.
- Email OTP TTL default is 5 min; rate-limit via better-auth config to prevent spam.

---

## Phase C — Phase 6 admin features ⏳

Backend endpoints, then frontend pages. All on Drizzle (Phase A complete).

### C1 — Backend endpoints

| Endpoint | Method | Roles | Notes |
|---|---|---|---|
| `/admin/users/:id` | PUT | ADMIN+ | Generic edit: membershipTier, isVerified, name. Excludes role (separate /admin/admins route). |
| `/admin/photos/pending` | GET | ADMIN+ | Lists `photos` where `adminApproved = false`. Paginated. |
| `/admin/photos/:id/approve` | PUT | ADMIN+ | Set `adminApproved = true`. |
| `/admin/photos/:id/reject` | PUT | ADMIN+ | Set `adminApproved = false` + optional reason; notify user. |
| `/admin/ads` | GET, POST | ADMIN+ | List + create. Ad model: targeting, schedule, CTA. |
| `/admin/ads/:id` | GET, PUT, DELETE | ADMIN+ | CRUD. |
| `/admin/ads/:id/impressions` | GET | ADMIN+ | Aggregates from `ad_impressions`. |
| `/admin/coupons` | GET, POST | ADMIN+ | List + create. |
| `/admin/coupons/:id` | GET, PUT, DELETE | ADMIN+ | CRUD. |
| `/admin/form-schema` | GET | ADMIN+ | Current live schema. |
| `/admin/form-schema` | POST | SUPER_ADMIN | Publish new version (inserts `form_schemas` + `form_fields`). |
| `/admin/form-schema/:id/activate` | PUT | SUPER_ADMIN | Flip active version. |
| `/admin/campaigns` | GET, POST | ADMIN+ | List + create. `email_campaigns`. |
| `/admin/campaigns/:id/send` | POST | ADMIN+ | Dispatch via Resend; populates `campaign_recipients`. |

All protected via existing `RolesGuard` + `@Roles()` decorator. DTO validation via `class-validator`.

### C2 — Frontend pages

| Route | Purpose | Backend |
|---|---|---|
| `/admin/photos` | Pending photo queue — grid of thumbnails with approve/reject. | Photo endpoints above |
| `/admin/ads` | Ads list + create/edit modal. Impression chart per ad. | Ads endpoints |
| `/admin/coupons` | Coupons list + create/edit. Redemption count. | Coupons endpoints |
| `/admin/campaigns` | Campaign composer + list. Send button triggers POST /send. | Campaign endpoints |
| `/admin/form-schema` | Schema editor — SUPER_ADMIN only. Field list with reorder, visibility, required flag. | Form-schema endpoints |

All use existing `.card` utility + CSS vars for theme parity. No new component library; extract `Modal`, `Table` local-first, promote to shared only if reused.

Sidebar nav in `apps/web/src/app/admin/layout.tsx` extended with links to new pages.

### Watch-outs
- Form-schema is load-bearing for signup: breaking changes must version, not mutate in place. Plan: `form_schemas.isActive` — only one row active at a time. New publish = insert + flip atomically.
- Campaign send is irreversible. Confirmation modal + no optimistic UI for the send button.
- Photo approval is a moderation surface — add audit log entry per approve/reject.

---

## Open questions / deferred

- Should MFA be required for **ADMIN** too, or only SUPER_ADMIN? Current plan: SUPER_ADMIN only (matches user request). Revisit if any ADMIN handles sensitive data.
- Ads targeting — `ads` model has targeting fields but admin UI v1 exposes a subset (ethnicity, age range, gender). Full targeting UI deferred until product signals demand.
- Campaign analytics (open/click tracking) — requires Resend webhook setup. Out of scope for Phase 6 v1.
