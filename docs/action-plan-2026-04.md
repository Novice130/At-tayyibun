# Action Plan — April 2026

Tracks three parallel initiatives: **Drizzle migration**, **MFA for SUPER_ADMIN**, and **Phase 6 admin features**. Ordered so downstream work doesn't get redone.

Start date: 2026-04-18
Branch: `main` (will split to feature branches per phase if blast radius grows)

---

## Order of execution

Drizzle first. Everything else (MFA, Phase 6) writes new DB code — doing it in Prisma then porting to Drizzle is throwaway work. Migrate ORM, verify the app still boots and logs in, *then* build new features on Drizzle.

1. **Drizzle migration** (Prisma → Drizzle + `@neondatabase/serverless`)
2. **MFA** (better-auth `two-factor` plugin — TOTP + email OTP, enforced for SUPER_ADMIN)
3. **Phase 6 backend** (6 endpoint groups)
4. **Phase 6 frontend** (5 admin pages)

Each phase lands as its own commit (or series) on `main`. No long-lived branches unless the user asks.

---

## Phase A — Drizzle migration

### Current state
- `apps/api` uses `@prisma/client` + `prisma` CLI, Neon Postgres (Serverless).
- 23 models / 9 enums in `prisma/schema.prisma` (516 lines).
- 19 backend files call `prisma.*` directly or via `PrismaService`.
- Frontend `apps/web/src/lib/auth.ts` uses `prismaAdapter` for better-auth.
- Seed scripts: `prisma/seed-admin.ts`, `prisma/seed.ts`.

### Target
- `drizzle-orm` + `drizzle-kit` in `apps/api`.
- Driver: `@neondatabase/serverless` (HTTP for most queries, WebSocket pool for transactions). Matches Neon guidance — skipped TCP pg driver to stay edge-compatible if we ever move the API to a serverless runtime.
- Schema: `apps/api/src/db/schema.ts` (single file, will split by domain if it balloons).
- Migrations: `apps/api/drizzle/` via `drizzle-kit generate`.
- `DrizzleService` (NestJS `@Injectable`) provides the typed client + `db` getter.
- Better-auth: `drizzleAdapter` from `better-auth/adapters/drizzle`.

### Strategy — keep the DB, replace the ORM

Neon DB already has user data (including `admin@attayyibun.com` as SUPER_ADMIN). We do **not** drop and recreate.

1. `drizzle-kit pull` against production DB to generate an initial schema.ts matching current tables.
2. Hand-tune generated schema: map column naming (snake_case DB → camelCase TS), restore enum types, add relations.
3. Baseline migration marker — `drizzle-kit migrate` with `--no-op` or similar so future migrations generate cleanly without trying to recreate existing tables.
4. Port query code **module by module**, running the app after each port to catch regressions early.

### Steps

1. **Deps** — `pnpm add drizzle-orm @neondatabase/serverless` in `apps/api`; `pnpm add -D drizzle-kit`. Keep Prisma until the last step so the app still boots mid-migration.
2. **drizzle.config.ts** at `apps/api/drizzle.config.ts` — points to Neon DATABASE_URL.
3. **Introspect** — `pnpm drizzle-kit pull` → generates `apps/api/drizzle/schema.ts`. Move + refactor into `src/db/schema.ts`. Add relation helpers (`relations()`) to match Prisma's `@relation` semantics.
4. **DrizzleService** at `src/db/drizzle.service.ts` + `drizzle.module.ts`. Wraps `drizzle(neon(DATABASE_URL))` with a singleton. Replaces `PrismaService` injection pattern.
5. **Port queries** — module order chosen by risk/blast radius:
   - `admin/` (just committed, I know it best)
   - `users/` + `profiles/` (core read paths)
   - `photos/`
   - `requests/`
   - `auth/` (custom pieces; better-auth adapter is separate)
   - `services/audit.service.ts`, `services/avatar.service.ts`
6. **Better-auth adapter** — swap `prismaAdapter(prisma, ...)` → `drizzleAdapter(db, { provider: "pg", schema })`. Verify login still works.
7. **Seeds** — rewrite `seed-admin.ts` + `seed.ts` in drizzle.
8. **Remove Prisma** — `pnpm remove @prisma/client prisma`, delete `prisma/` directory, delete `src/prisma/`.
9. **Verify** — `pnpm build` + smoke-test `/auth/sign-in/email`, `/admin/analytics`, `/admin/users`.

### Watch-outs
- Prisma encodes enum types as native Postgres enums; drizzle `pgEnum()` uses the existing type names — must match exactly or migrations drift.
- `String[]` arrays (e.g. `twoFactorBackupCodes`) map to `text().array()` in drizzle.
- `@db.Uuid`, `@db.Date`, `@db.Decimal(p,s)` — drizzle-kit pull usually gets these right but verify.
- Prisma `onDelete: Cascade` on relations → drizzle `references(() => ..., { onDelete: 'cascade' })`.
- `advanced.database.generateId: "uuid"` in better-auth config stays; adapter-agnostic.

---

## Phase B — MFA for SUPER_ADMIN

### Current state
- Custom `TwoFactorService` exists at `apps/api/src/modules/auth/two-factor.service.ts` using `otplib` + `qrcode`. **Not wired** to any controller/route. Unused.
- User model already has `twoFactorSecret` (encrypted), `twoFactorEnabled`, `twoFactorBackupCodes` columns.
- Better-auth v1.1.x ships a first-party `two-factor` plugin supporting TOTP + backup codes + OTP (email).

### Target
- Use **better-auth `two-factor` plugin** — cleaner integration than the custom service. Handles session challenges, backup codes, QR code, OTP email delivery.
- TOTP via authenticator app (Google Authenticator / Authy / 1Password).
- Email OTP as secondary factor / fallback (Resend, already configured in repo).
- **MFA is required for SUPER_ADMIN.** On login, if user role is SUPER_ADMIN and 2FA not enabled, force setup before granting session. If enabled, require TOTP or email OTP after password success.
- Optional for ADMIN. Optional for USER.

### Steps

1. **Enable plugin** in `apps/web/src/lib/auth.ts`:
   ```ts
   import { twoFactor } from "better-auth/plugins/two-factor";
   plugins: [twoFactor({ otpOptions: { async sendOTP({ user, otp }) { /* Resend */ } } })]
   ```
2. **Client plugin** in `apps/web/src/lib/auth-client.ts` — `twoFactorClient()`.
3. **Schema** — plugin requires a `twoFactor` table; generate migration via `drizzle-kit`. Keep existing `twoFactorSecret/Enabled/BackupCodes` User columns for the custom service until it's removed; plugin uses its own table.
4. **Email OTP transport** — wire `sendOTP` to Resend. Template: plain text with 6-digit code + "Do not share."
5. **SUPER_ADMIN enforcement** — middleware / guard:
   - `apps/web/src/app/admin/layout.tsx` already gates on role. Extend: if role=SUPER_ADMIN and `session.user.twoFactorEnabled === false`, redirect to `/admin/security/setup` before showing admin chrome.
   - Backend: a Nest guard on `@Roles(Role.SUPER_ADMIN)` routes that checks `session.user.twoFactorVerified === true` for the current session. Plugin surfaces a session flag.
6. **Setup page** `/admin/security/setup` — shows QR, text secret fallback, code input to verify enrollment, displays 10 backup codes once.
7. **Login challenge page** `/auth/two-factor` — TOTP input + "Send email OTP instead" link. Better-auth handles the challenge endpoint; we build the UI.
8. **Remove custom service** — delete `two-factor.service.ts`, `two-factor.dto.ts`, `EncryptionService` 2FA helpers if unused elsewhere.

### Watch-outs
- Better-auth's two-factor plugin stores secrets encrypted using the `BETTER_AUTH_SECRET` env var. Make sure this is set in prod (already set per existing `.env`).
- Backup codes are shown **once**. UI must make that very clear.
- If SUPER_ADMIN loses their authenticator AND backup codes AND email access, they're locked out. Document the SQL recovery path in `admin-panel-notes.md`.
- Email OTP TTL: 5 min. Rate-limit to prevent spam (plugin has this; verify the default).

---

## Phase C — Phase 6 admin features

Backend endpoints, then frontend pages. All on Drizzle (Phase A must complete first).

### C1 — Backend endpoints

| Endpoint | Method | Roles | Notes |
|---|---|---|---|
| `/admin/users/:id` | PUT | ADMIN+ | Generic edit: membershipTier, isVerified, name. Excludes role (separate /admin/admins route). |
| `/admin/photos/pending` | GET | ADMIN+ | Lists Photo rows where `adminApproved = false`. Paginated. |
| `/admin/photos/:id/approve` | PUT | ADMIN+ | Set `adminApproved = true`. |
| `/admin/photos/:id/reject` | PUT | ADMIN+ | Set `adminApproved = false` + optional reason; notify user. |
| `/admin/ads` | GET, POST | ADMIN+ | List + create. Ad model has targeting, schedule, CTA. |
| `/admin/ads/:id` | GET, PUT, DELETE | ADMIN+ | CRUD. |
| `/admin/ads/:id/impressions` | GET | ADMIN+ | Aggregates from `AdImpression`. |
| `/admin/coupons` | GET, POST | ADMIN+ | List + create. |
| `/admin/coupons/:id` | GET, PUT, DELETE | ADMIN+ | CRUD. |
| `/admin/form-schema` | GET | ADMIN+ | Current live schema. |
| `/admin/form-schema` | POST | SUPER_ADMIN | Publish new version (creates FormSchema + FormField rows). |
| `/admin/form-schema/:id/activate` | PUT | SUPER_ADMIN | Flip active version. |
| `/admin/campaigns` | GET, POST | ADMIN+ | List + create. EmailCampaign. |
| `/admin/campaigns/:id/send` | POST | ADMIN+ | Dispatch via Resend; populates CampaignRecipient. |

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
- Form-schema is load-bearing for signup: breaking changes must version, not mutate in place. Plan: `FormSchema.active: boolean` — only one row active at a time. New publish = insert new row, flip active flag atomically.
- Campaign send is irreversible. Confirmation modal + no optimistic UI for the send button.
- Photo approval is a moderation surface — add audit log entry per approve/reject.

---

## Open questions / deferred

- Should MFA be required for **ADMIN** too, or only SUPER_ADMIN? Current plan: SUPER_ADMIN only (matches user request). Revisit if any ADMIN handles sensitive data.
- Ads targeting — `Ad` model has fields for targeting but admin UI v1 exposes a subset (ethnicity, age range, gender). Full targeting UI deferred until product signals demand.
- Campaign analytics (open/click tracking) — requires Resend webhook setup. Out of scope for Phase 6 v1.
