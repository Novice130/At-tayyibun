# Session Handoff — Apr 24-26 2026

> Single canonical handoff for the auth/DB stabilization marathon. Use this
> doc to onboard a fresh session. The previous per-day fragments
> (`session-handoff-2026-04-24.md`, `-25.md`, `-25b.md`,
> `nvidia-ai-changes-2026-04-26.md`) have been merged into this file.

---

## 1. Current state (2026-04-26 morning)

All known prod-blockers cleared. Last verified end-to-end:

- ✅ Sign-up → /profile/setup → Complete Profile → /browse
- ✅ Sign-in (regular user) → /browse
- ✅ Sign-in (admin) → 2FA challenge → single OTP email → /admin
- ✅ /api/profiles/me, /api/admin/analytics, /api/admin/users all 200
- ✅ Browse returns opposite-gender complete profiles (verified 12 men for
  female session)

Verified via curl + `diagnostics/drive-admin-login.ts` (Playwright script
that reads OTP from DB so the flow can be exercised without an inbox).

---

## 2. The bug chain we walked through

The marathon was cumulative — each fix exposed the next layer.

### Layer 0: BetterAuth UUID generation (Apr 24, commit `be7fa2d`)
Sign-up returned 500. `auth.ts` had `advanced.generateId: "uuid"` (string)
instead of a function. BetterAuth tried to call the string as a function
and crashed inside the user-create hook. Fix: `generateId: () => crypto.randomUUID()`.

### Layer 1: Sentry blowing the build (Apr 25, commits `d0a1305`, `cb5fb21`)
Sentry's webpack pass on Next 15 + 3.7 GiB VPS pushed memory over the
ceiling and the Dokploy build OOMed. Sentry imports + config were
commented out, build heap was capped at 4 GiB, and `.dockerignore` stopped
stripping `public/` images. To re-enable Sentry we need a bigger VPS.

### Layer 2: Lazy SDK constructors (Apr 25, commits `7085143`, `5422571`)
`@google-cloud/storage` and `resend` constructors threw at module load when
their env vars were unset, which crash-looped the whole API on boot. Both
were moved behind lazy getters that throw only on first real use.

### Layer 3: Cookie + seed gaps (Apr 25, commits `51fe05b`, `60ced15`)
- BetterAuth signs the session cookie as `<token>.<signature>`. The Nest
  `BetterAuthGuard` was looking up the raw cookie value in the `session`
  table, which never matched. Fix: split on `.` and use the prefix.
- `db:seed` created `users` rows but skipped the `account` row that
  BetterAuth needs for credential auth, so seeded test users couldn't
  sign in. Seed now upserts the `account` row.

### Layer 4: Profile setup pre-fill (Apr 25, commit `747d3fd`)
Sign-up captured `gender` but never persisted it. The profile setup wizard
re-asked for gender (with no UI affordance for it) and the INSERT path in
`profiles.service.ts` defaulted to `MALE` for everyone. We now `PUT
/profiles/me` immediately after sign-up so the wizard pre-fills.

### Layer 5: 2FA partial session loop (Apr 25, commits `0ac7356`, `a720aec`)
- BetterAuth's `/auth/get-session` returns `null` during partial 2FA, so
  the admin layout was redirecting away from the challenge page before the
  user could enter their OTP. Fix: gate `/admin` on session, but never
  gate the challenge page itself.
- `session` table needed `two_factor_verified` + `factors` columns to keep
  Drizzle relational queries from blowing up — the columns were added.
  (See Layer 8 for the gotcha — BetterAuth never writes them.)

### Layer 6: Neon WebSocket blocked in Docker (Apr 26, commit `37dd401`)
**Root cause for the multi-endpoint 500 wave on Apr 26.** The Dokploy
overlay network refused outbound WebSocket upgrades to Neon, so every DB
query under `BetterAuthGuard.canActivate` failed with `All attempts to
open a WebSocket to connect to the database failed / fetch failed`. The
500s on `/api/profiles/me`, `/api/admin/analytics`, and the OTP verify
path all fanned out from this.

Fix: drop the `drizzle-orm/neon-serverless` driver, switch both API and
web to `drizzle-orm/node-postgres` over plain TLS port 5432. Neon accepts
standard `pg` connections; no WebSocket needed. Seed scripts still use
the WS driver because they only ever run from a dev machine.

### Layer 7: RolesGuard checked a column nobody writes (Apr 26, commit `d1acac1`)
After OTP verify, every admin endpoint returned `403 MFA_REQUIRED`. Cause:
`RolesGuard` checked `request.session.twoFactorVerified`, but BetterAuth
never writes that column even after a successful verify. Since BetterAuth
only issues the `session_token` cookie *after* a successful OTP, the mere
existence of a session in `BetterAuthGuard` already proves 2FA was
satisfied. Drop the redundant check.

### Layer 8: Double `sendOtp` on challenge mount (Apr 26, commits `c4b077a`, `1bf42ac`)
The challenge page fired `twoFactor.sendOtp()` twice on mount. BetterAuth
invalidates the previous OTP whenever a new one is issued, so the user
got two emails and only the second code worked — typing the first email's
code returned `401 INVALID_CODE`, which felt like a backend bug.

The first attempt (a `useRef` guard) didn't survive React 18 StrictMode /
router-induced remounts — refs reset on a fresh component instance. Fix:
hoist the guard to module scope so it persists across remounts within the
browser tab.

While we were there, both the login and OTP forms got `useRef`-based
submission guards in case Cloudflare Rocket Loader (now disabled) ever
double-fires submit handlers again.

---

## 3. Architecture quick-reference

- **NestJS API** — `apps/api`, port 3001, all routes prefixed `/api`
- **Next.js web** — `apps/web`, port 3000, rewrites `/api/*` →
  `127.0.0.1:3001/api/*` via `next.config.js`
- **BetterAuth lives in the WEB app** (`apps/web/src/lib/auth.ts`), not
  in NestJS. Auth routes are at `/auth/[...all]` (no `/api` prefix).
- The Nest `BetterAuthGuard` validates the BetterAuth session cookie
  against the shared Neon DB, then attaches `request.user` and
  `request.session`.
- **DB driver** — both API and web use `drizzle-orm/node-postgres` with a
  standard `pg` Pool over TLS. Do not switch back to `neon-serverless` /
  WebSocket without first proving the Dokploy network allows the upgrade.
- `ENCRYPTION_KEY` — 32-byte AES key as 64-char hex. Required at API
  start (the encryption service throws otherwise).
- Dokploy app IDs (full credentials are in user memory, not committed):
  - web — Dockerfile.web, auto-deploys on push to `main`
  - api — Dockerfile.api, auto-deploys on push to `main`

---

## 4. Test accounts

`pnpm --filter @at-tayyibun/api db:seed` recreates these (clears + reseeds).

**Admin** — `admin@attayyibun.com` (SUPER_ADMIN), MFA enabled in prod.
Password is in the user's Claude memory file `reference_test_accounts.md`,
not committed here. Rotate before going to real users.

**Test users** — password `Test@123`, all `@example.com`, pre-verified
with complete profiles. 12 men + 10 women, mixed tiers and ethnicities.

The seed also creates the `account` row (`providerId='credential'`) — a
manual fix from commit `51fe05b` that's now permanent.

---

## 5. Lessons we should not relearn

- **Constructor-throws-on-missing-env is a footgun.** Two prod boot loops
  in three days from this exact pattern (`@google-cloud/storage`, then
  `resend`). Any external SDK that requires env at construction time goes
  behind a lazy getter that throws on first use.
- **WebSockets in Docker overlays are not portable.** Default to plain
  TCP + TLS for Postgres; reach for WS only if the platform proves it's
  supported. Same will likely apply to Redis pub/sub, Pusher, etc.
- **Custom session columns aren't auto-populated.**
  `session.two_factor_verified` was a phantom — BetterAuth never wrote it,
  so checking it as gospel built infinite 403 loops. Either don't add such
  columns, or write to them in a `customSession` callback.
- **BetterAuth signs cookies.** The cookie value is `<token>.<signature>`.
  Strip the signature before any DB lookup against the `session` table.
  And the cookie name flips between `better-auth.session_token` and
  `__Secure-better-auth.session_token` (prod) — handle both.
- **`useRef` does not protect against remounts.** React 18 StrictMode and
  Next.js client navigations both create fresh component instances, which
  reset refs. For "fire exactly once per tab" guards, use a module-scope
  variable instead.
- **Pre-seed profile data immediately after sign-up.** Carrying state in
  sessionStorage / URL across the sign-up → wizard hop is lossy. A small
  `PUT /profiles/me` after sign-up keeps the wizard pre-fill reliable.
- **Boolean `||` chains aren't completeness checks.** Use explicit `&&`
  over a known field list. `data.firstName || existing.firstName ||
  fallback` short-circuits in surprising ways for empty strings.
- **Dual `node_modules` (root hoisted + workspace) confuses DI.** When a
  Nest DI error looks impossible, `readlink apps/<pkg>/node_modules/@some/dep`
  before believing the lockfile.
- **Slim Docker images per workspace.** A 1.5 GB hoisted pnpm tree won't
  COPY onto a 3.7 GiB VPS. Use a `prod-deps` Dockerfile stage with
  `pnpm install --filter <pkg> --prod`.
- **Read prod logs before adding more diagnostics.** A whole branch of
  this session was spent layering try/catches without ever harvesting the
  one we already had. `docker service logs ... | grep -B2 -A30 -iE
  "error|exception"` is the first move on any 500.

---

## 6. Pending items

| Item | Notes |
|---|---|
| Rotate prod secrets | Neon password, BetterAuth secret, Resend API key, Sentry token. `ENCRYPTION_KEY` rotation requires re-encrypting stored data — handle with care. See user memory `project_secret_rotation_pending.md`. |
| `testsister1@example.com` | `profile_complete=false` (no bio, no last name, no ethnicity). Either redo the wizard or relax the completion check at `apps/api/src/modules/profiles/profiles.service.ts:232` to drop `bio` + `lastName` from required fields. |
| Local Redis | API spams `ECONNREFUSED 127.0.0.1:6379` in dev because BullMQ tries to connect. Either install Redis locally or guard `BullModule` registration on `REDIS_URL`. Cosmetic only. |
| Re-enable Sentry on web | Currently fully commented out. Wait until VPS is bigger than 3.7 GiB; Sentry's webpack pass blew the heap last time. |
| Regenerate `graphify-out/` | Last graph is from Apr 25 (pre-DB-swap). Regenerate after the next big change so future sessions get accurate context. The user runs the graphify CLI; it isn't in `package.json`. |
| MCP `application-saveEnvironment` | Returns 400 — couldn't update Dokploy env via MCP, fell back to UI. Investigate when convenient. |

---

## 7. Procedures the next session will want

### Tail prod API logs for errors
```bash
docker service logs attayibun-api-nvxlws --tail 200 2>&1 \
  | grep -B2 -A30 -iE "error|exception" | tail -80
```

### Force-redeploy the API
```bash
docker service update --force attayibun-api-nvxlws
```

### Confirm the latest code actually shipped
```bash
docker service logs attayibun-api-nvxlws --tail 30 2>&1 \
  | grep -E "DrizzleService|node-postgres pool init"
```

### Drive admin login end-to-end without an inbox
```bash
DATABASE_URL='<neon-pooler-url>' \
  pnpm --filter @at-tayyibun/web exec tsx ../../diagnostics/drive-admin-login.ts
```
Reads the latest OTP straight from the `verification` table and types it
into the headless browser. Useful to isolate "is this backend or
browser?" the moment a 401 shows up again.

### Local dev
```bash
pnpm dev   # from monorepo root — web :3000 + api :3001 via Turborepo
```
