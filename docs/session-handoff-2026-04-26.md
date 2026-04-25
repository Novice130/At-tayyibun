# Session Handoff — 2026-04-26

> Full context for continuing work after the 2026-04-25/26 fix marathon. Use the
> "Open problem" section at the top to start a focused new session; the rest is
> background and lessons learned.

---

## 1. Open problem — Multiple endpoints returning 500 in prod

**Symptoms** (BOTH failing in production, NOT just admin):
- `GET /api/admin/analytics` → 500. Admin dashboard shows red "Internal
  server error" banner. Sidebar + role + sign-out all render fine; only
  the analytics fetch fails.
- `PUT /api/profiles/me` → 500. Browser console:
  ```
  PUT https://attayyibun.com/api/profiles/me 500 (Internal Server Error)
  ```
  Reproduces with a brand-new (non-admin) signup completing the 5-step
  profile setup wizard. Step 5 → Complete Profile → red "Internal server
  error" banner above the form.

**What's ruled out**:
- API is up (`docker service ls | grep attayibun-api` → `1/1`)
- Auth works (admin sidebar renders SUPER_ADMIN; new signups successfully
  reach the wizard)
- MFA works (we got past `/admin/security/challenge`)
- `RESEND_API_KEY`, `ENCRYPTION_KEY`, `DATABASE_URL` all set in Dokploy env
- Latest API commit `5422571` (lazy Resend) deployed `status: done`
- AuditLogInterceptor is NOT the cause — its `auditedPaths` list doesn't
  include `GET /admin/*` or `PUT /profiles/*`, so it short-circuits both
  endpoints before any audit write happens

**The signal — both endpoints touch the DB**: `getAnalytics` runs 7
`count()` queries; `updateMyProfile` does a `SELECT … FROM profiles WHERE
user_id = …` then `INSERT INTO profiles (…)` with several columns. They
share no other code path. Strong signal of **DB schema drift between local
and prod Neon** — a column or table the queries reference is missing,
extra, or renamed in prod.

**Most likely causes** (re-ranked given both endpoints fail):
1. **DB schema drift in prod Neon.** Most likely culprit. Local schema in
   `apps/api/src/db/schema.ts` may have evolved (e.g. recent commits added
   `publicFields.hideLocation`, `lastNameEnc`, `biodataJsonEnc`). If
   `pnpm --filter @at-tayyibun/api db:push` was never run against prod
   `DATABASE_URL`, INSERTs/SELECTs hit non-existent columns and throw.
2. **`RolesGuard` mismatch** (only explains analytics failure, not
   profiles/me). Less likely now that profiles/me also fails for non-admin
   signups — but worth ruling out by reading
   `apps/api/src/common/guards/roles.guard.ts` and confirming
   `request.user.role` is set as the enum string.
3. **Drizzle relational query failure** — both endpoints use the relational
   query API. If `usersRelations` / `profilesRelations` reference a
   foreign key that doesn't exist in prod, queries throw.

**How to diagnose** (5 min — DO THIS FIRST):
```bash
# On VPS — get the actual stack trace
docker service logs attayibun-api-nvxlws --tail 200 2>&1 \
  | grep -B2 -A30 -iE "error|exception" \
  | tail -80
```
Trigger one of the failing endpoints in the browser, then immediately tail
again. The stack trace will name the failing column / table / service.

**Suggested fix path** (depends on log):
- **If schema drift** (`column "X" does not exist`, `relation "Y" does
  not exist`): run drizzle generate + push against prod:
  ```bash
  cd apps/api
  DATABASE_URL=<prod-url> pnpm exec drizzle-kit push
  ```
  ⚠️ This is destructive — review the diff before applying. Take a Neon
  branch backup first.
- **If RolesGuard**: fix `request.user.role` extraction in
  `better-auth.guard.ts` or guard.
- **If Drizzle relations**: align `relations.ts` with the prod schema.

After fix, verify BOTH endpoints:
```bash
curl -s 'https://attayyibun.com/api/admin/analytics' \
  -H "cookie: better-auth.session_token=<paste-from-browser>" | head
# Should return JSON with totalUsers etc., not 500
```
And in browser: complete the profile wizard with a fresh signup; should
redirect to /browse without error banner.

---

## 2. Dummy accounts (for new session testing)

All seeded by `pnpm --filter @at-tayyibun/api db:seed` (clears + recreates).
Admin seeded separately by `db:seed:admin` (idempotent, safe to re-run).

**Admin** — password: `ChitapataChinukulu`
- `admin@attayyibun.com` → SUPER_ADMIN
- MFA is now ENABLED in production (was setup during testing). Backup codes
  written down by user. New OTP arrives in admin's email per login.

**Test users** — password: `Test@123`, all `@example.com`, all pre-verified
with complete profiles:

| Email | Name | Age | Tier | Gender |
|---|---|---|---|---|
| ahmad0@example.com | Ahmad Rahman | 28 | GOLD | M |
| yusuf1@example.com | Yusuf Al-Farsi | 31 | SILVER | M |
| omar2@example.com | Omar Diallo | 26 | FREE | M |
| ibrahim3@example.com | Ibrahim Kaya | 33 | GOLD | M |
| hassan4@example.com | Hassan Mirza | 29 | SILVER | M |
| bilal5@example.com | Bilal Osman | 35 | FREE | M |
| tariq6@example.com | Tariq Hussain | 27 | FREE | M |
| khalid7@example.com | Khalid Nasser | 30 | SILVER | M |
| hamza8@example.com | Hamza Wijaya | 25 | FREE | M |
| faisal9@example.com | Faisal Ahmed | 32 | GOLD | M |
| fatima10@example.com | Fatima Zahra | 25 | GOLD | F |
| aisha11@example.com | Aisha Patel | 27 | SILVER | F |
| khadija12@example.com | Khadija Toure | 24 | FREE | F |
| maryam13@example.com | Maryam Yilmaz | 29 | GOLD | F |
| noor14@example.com | Noor Rezaei | 26 | SILVER | F |
| layla15@example.com | Layla Washington | 28 | FREE | F |
| sara16@example.com | Sara Khan | 23 | FREE | F |
| amina17@example.com | Amina Hassan | 30 | SILVER | F |
| yasmin18@example.com | Yasmin Putri | 26 | FREE | F |
| sumaya19@example.com | Sumaya Ali | 31 | GOLD | F |

Note: seed ALSO creates the `account` row (providerId `credential`) — this
was missing before commit `51fe05b` so test accounts couldn't sign in.

---

## 3. What was fixed in this session (commits on `main`)

| Commit | Title | Lesson |
|---|---|---|
| `51fe05b` | seed credential accounts + strip better-auth cookie signature | better-auth signs cookies as `<token>.<signature>`; raw cookie ≠ DB token. better-auth credentials live in `account` table, NOT `users.passwordHash` |
| `747d3fd` | persist gender from signup so profile setup pre-fills it | `data.firstName \|\| ...` short-circuits; never use `\|\|` chains for boolean intent. Pre-seeding profile fields with placeholder values pollutes wizard pre-fill — gate on `profileComplete` |
| `0ac7356` | unblock MFA challenge during partial 2FA session | better-auth `/auth/get-session` returns `null` during partial 2FA. Don't gate the challenge page itself on session. `session.twoFactorVerified` column exists in schema but better-auth never writes it — non-null session IS the proof of verification |
| `9a13698` | slim API image with prod-only deps stage | Dokploy 3.7 GB VPS can't COPY a 1.5 GB hoisted node_modules. Use `pnpm install --filter <pkg> --prod` in a separate stage |
| `5422571` | lazy-construct Resend so missing key doesn't crash boot | Same lesson as `7085143` (StorageService): SDK constructors that throw on missing config must be lazy, otherwise prod env-var typo crash-loops the whole API |

---

## 4. Lessons learned (worth building habits around)

**Constructor-throws-on-missing-env is a foot-gun.** Twice in 2 days
(`@google-cloud/storage`, then `resend`) we hit boot crashes because an SDK
constructor required an env var. Going forward, any external SDK
instantiation should sit behind a lazy getter that throws only on first use.
The pattern:
```ts
private instance?: SDK;
private get sdk(): SDK {
  if (!this.instance) {
    const key = this.config.get<string>('THE_KEY');
    if (!key) throw new Error('THE_KEY not configured');
    this.instance = new SDK(key);
  }
  return this.instance;
}
```

**Dual node_modules (hoisted root + workspace) confuses everything.**
The Bull DI crash on local was a symptom: pnpm workspace had Nest 10 linked,
root had Nest 11 from a stray `npm install`. Lockfile said 11, but symlinks
were stale. Fix: `rm -rf apps/api/node_modules && pnpm install --filter ...`.
Always check `readlink apps/<pkg>/node_modules/@some/dep` when DI errors are
weird — the version in the lockfile is not always what's on disk.

**Better-auth has two cookie shapes.** `better-auth.session_token` and
`__Secure-better-auth.session_token` (prod). Both need to be checked. And
both contain `<token>.<signature>` — split before the DB lookup.

**Custom session columns aren't auto-populated.** `session.twoFactorVerified`
existed in our schema from a presumed customization, but better-auth doesn't
know about it and never writes to it. If you check it as gospel, you build
infinite loops. Either don't add such columns, or write to them yourself
in a customSession callback.

**Boolean intent `||` chains are a smell.** When checking "is this thing
complete?", use explicit `&&` over an explicit list of fields. Falsy short-
circuit logic is rarely what you mean for completeness checks.

**Dockerfile `COPY --from=deps node_modules` is fine for small repos, fatal
for monorepos with hoisted pnpm.** A separate `prod-deps` stage that filters
to one workspace package is the standard pattern; do this from day one.

**Pre-seed profile rows from signup if you collect data there.** Carrying
state from signup to `/profile/setup` via session storage is lossy across
tabs. A small `PUT /profiles/me` immediately after signup is reliable.

**Verify MCP responses contain secrets.** `mcp__dokploy-mcp__application-one`
returns full env including the GitHub App private key. If running with
multiple humans watching the transcript, this matters.

---

## 5. Still pending (handed off)

- [ ] **Admin dashboard 500** — see §1
- [ ] **Rotate prod secrets** — Neon DB password, Better-Auth secret,
      Resend API key, Sentry token. Memory file
      `project_secret_rotation_pending.md` has the full list. The
      `ENCRYPTION_KEY` rotation requires re-encrypting all stored data;
      do that one carefully.
- [ ] **Local Redis** — API spams `ECONNREFUSED 127.0.0.1:6379` in dev
      because BullMQ tries to connect. Either install Redis on dev
      machines or guard `BullModule` registration behind `REDIS_URL`.
      Cosmetic; only affects log noise locally.
- [ ] **MCP `application-saveEnvironment` returns 400** — couldn't update
      env via MCP; had to use Dokploy UI. Investigate when convenient.
- [ ] **Re-enable Sentry on web app** once VPS is upgraded past 3.7 GB
      (currently disabled because Sentry's webpack pass blew the heap).

---

## 6. Architecture reminders (don't re-derive next session)

- **NestJS API** at `apps/api`, port 3001, prefix `/api`
- **Next.js web** at `apps/web`, port 3000
- Web rewrites `/api/*` → `127.0.0.1:3001/api/*` via `next.config.js`
- **Better-auth** lives in `apps/web/src/lib/auth.ts` — Next.js, NOT NestJS
- Auth routes at `/auth/[...all]` (NOT under `/api`)
- NestJS `BetterAuthGuard` validates session cookie against shared Neon DB
- `ENCRYPTION_KEY` = 64-char hex (32 bytes for AES-256)
- Dokploy app IDs (in user memory `reference_dokploy_app.md`):
  - web: `kR_VYSPSAMuzU6peeBtt9` (`Dockerfile.web`)
  - api: `9E23qdq8WrdmisgYgis94` (`Dockerfile.api`)
  - both auto-deploy on push to `main`

---

## 7. Re-run graphify before next big change

`graphify-out/` is a generated codebase graph. After this session's changes
touched 5 files across api + web, regenerate it so future agents have
accurate context. Whatever command produced `graphify-out/graph.html` (it
isn't in `package.json`, so it's an external CLI the user runs).
