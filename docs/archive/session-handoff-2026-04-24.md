# Session Handoff — 2026-04-24

> Paste this into a new Claude Code session as context. It captures
> the auth/Sentry issues, every fix made today, what is still pending,
> and a project-wide review of cleanup candidates.

---

## 1. Original problem

Production signup and signin both broken on https://attayyibun.com.

- **Signup** → `POST /auth/sign-up/email` returned `422 Unprocessable Entity`
  body `{"message":"Failed to create user","code":"FAILED_TO_CREATE_USER"}`.
- **Signin** → UI alert "Failed to sign in. Please try again." Sentry
  captured `Error: No error message at LoginForm.tsx:31` (the `throw new
  Error(authError.message)` line, where `authError.message` was empty).
- Sentry was newly installed in the web app; build logs were also full
  of Sentry deprecation + missing-instrumentation warnings.

## 2. Root cause

`apps/web/src/lib/auth.ts` had:

```ts
advanced: { database: { generateId: "uuid" } }
```

Better-Auth's runtime checks `typeof generateId === "function"`. A
string passes the truthy check but is not a function → SDK skips ID
generation entirely. The DB column `users.id` is `uuid PRIMARY KEY NOT
NULL` with **no DB-level default**, so the INSERT produced
`id = DEFAULT` → `null`, raising:

```
null value in column "id" of relation "users" violates not-null constraint
```

Better-Auth wraps the SQL error as the generic `FAILED_TO_CREATE_USER`,
hiding the real cause. The same bug also breaks signin because
`session.id`, `account.id`, `verification.id` are all `uuid PK NOT
NULL` with no defaults — session creation fails on every signin.

**How verified:** wrote a throwaway script that called
`betterAuth.api.signUpEmail()` directly and printed the underlying
Drizzle/Postgres error. Confirmed `null value in column "id"`.

## 3. Adjacent issues that were *already* fixed before this session
(from `git log`)

- `449edited` `fix(db): correct camelCase column names + fix Redis URL parsing`
- `60ced15` `fix(seed): upsert account row when user exists but account is missing`
- `a720aec` `fix(web): add twoFactorVerified + factors to session schema for twoFactor plugin`

These were necessary and correct, but **none of them was the cause of
the signup/signin failure**. They addressed adjacent symptoms.

## 4. Fixes pushed today

| Commit    | What |
|-----------|------|
| `be7fa2d` | `generateId: () => randomUUID()`; wired `Sentry.captureException` in LoginForm/SignupForm; piped Better-Auth error logs to Sentry via `logger.onLog` |
| `da25978` | First `src/instrumentation.ts` (with import-style); first `src/app/global-error.tsx`; moved DSN to `NEXT_PUBLIC_SENTRY_DSN` env var |
| `d77aa8d` | Migrated to `@sentry/nextjs` 10.x pattern: inlined `Sentry.init` into `src/instrumentation.ts`; created `src/instrumentation-client.ts`; deleted legacy `sentry.{client,server,edge}.config.js`; nested deprecated `next.config.js` options under `webpack.*` |
| `aba1786` | Lowered `tracesSampleRate` 1 → 0.1; `replaysSessionSampleRate` 0.1 → 0; `widenClientFileUpload` true → false (was pegging the 3.7 GiB VPS at 100% CPU and bloating build/source-map upload) |

**Local verification:** direct API call to better-auth → signup OK,
signin OK, valid UUID + session token. Local build emits zero Sentry
deprecation/instrumentation warnings.

## 5. Deployment situation

- Auto-deploy is **on** in Dokploy (push to `main` triggers).
- Three Apr 24 deploys (`be7fa2d`, `d77aa8d`, two manual retries) were
  **cancelled** — likely OOM during build (Sentry source-map upload +
  Next 15 build on a 3.7 GiB VPS) or user-cancelled during the CPU
  peg.
- A manual deploy `0Ob7qOCjhItc1UrYHvX3J` was running at 11:11 UTC.
- **Latest production smoke test still returned `FAILED_TO_CREATE_USER`** —
  meaning the live build is still pre-`be7fa2d`. Need to confirm the
  in-flight deploy actually succeeds and serves `aba1786`.

**Required Dokploy env vars (already added):**
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

**If deploys keep cancelling:** temporarily clear `SENTRY_AUTH_TOKEN`
to skip source-map upload (cuts build time + memory). Source maps just
won't be uploaded for that build.

## 6. 🚨 SECURITY — secrets exposed

The Dokploy MCP `application-one` call returned the full env block
inline. Today's session transcript now contains:

- Neon DB password (`DATABASE_URL`)
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `SENTRY_AUTH_TOKEN`
- **GitHub App private RSA key**, `githubClientSecret`,
  `githubWebhookSecret`

**Rotate every one of these.** GitHub App key is the most urgent —
anyone with it can act as your Dokploy app on every connected repo.

## 7. Project review — Prisma leftovers

The user reported "I still see prisma in the build". Investigation:

- No `package.json` in the workspace declares `prisma` or
  `@prisma/client` as a direct dep.
- `pnpm-lock.yaml` does pull in `@prisma/client@6.19.3` + `prisma@6.19.3`
  because they are **optional peer deps** of `better-auth` and
  `drizzle-orm`. pnpm satisfies them by default.
- This is harmless to correctness but adds ~30 MB to `node_modules`
  and shows up in build logs.

To suppress, add to repo-root `.npmrc`:

```
auto-install-peers=false
```

…or add a `pnpm.peerDependencyRules.ignoreMissing` block in root
`package.json`. After the change, `pnpm install --force` and verify the
lockfile no longer references `@prisma/client`.

**Stale Prisma artifacts to delete:**

- `apps/web/test-prisma.ts` — orphan script that imports
  `PrismaClient` (Prisma is gone, this won't run).
- `backup_untracked/test-prisma.ts` — same script in the backup
  folder.
- Mentions in `docs/action-plan-2026-04.md`,
  `docs/admin-panel-notes.md`, `docs/walkthrough.md`,
  `docs/task.md`, `docs/implementation_plan.md` are historical
  references — keep or delete by judgement.

## 8. Other cleanup candidates

- `backup_untracked/` (1.5 MB) — `temp_modest_ummah/`, screenshots,
  the orphan `test-prisma.ts`. Untracked, safe to delete.
- `apps/web/tsconfig.tsbuildinfo` — TS incremental cache; should be
  in `.gitignore` if not already.
- `apps/web/.next` (748 MB) — local build artifact; gitignored, but
  worth confirming nothing in CI commits it.
- `docs/implementation_plan.md`, `docs/action-plan-2026-04.md`,
  `docs/walkthrough.md` — old planning docs from before the Prisma →
  Drizzle migration. Decide whether to keep as history or remove.

## 9. What to do at the start of the next session

1. Confirm the in-flight Dokploy deploy succeeded — query Dokploy MCP
   `application-one` for app `kR_VYSPSAMuzU6peeBtt9` and check
   `deployments[0].status === "done"`.
2. Smoke-test:
   ```bash
   curl -i -X POST https://attayyibun.com/auth/sign-up/email \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-$(date +%s)@example.com","password":"TestPassword123!","name":"Smoke","image":"/avatars/male/male-1.jpg"}'
   ```
   Expect `200 OK` with a user object. Then test signin.
3. After signup works, delete the smoke test row:
   ```sql
   DELETE FROM users WHERE email LIKE 'smoke-%@example.com';
   ```
4. Address §6 (rotate secrets), §7 (Prisma cleanup), §8 (other cleanup).
5. If CPU pegs again, disable `tunnelRoute: "/monitoring"` in
   `apps/web/next.config.js` so client Sentry traffic goes direct
   to `*.ingest.sentry.io` instead of through the Next.js server.

## 10. Files to know

| File | Purpose |
|------|---------|
| `apps/web/src/lib/auth.ts` | Better-Auth server config — the `generateId` fix lives here |
| `apps/web/src/lib/auth-client.ts` | Better-Auth React client |
| `apps/web/src/app/auth/[...all]/route.ts` | Catch-all route that mounts Better-Auth handler |
| `apps/web/src/lib/db-schema.ts` | Drizzle schema (introspected from DB) |
| `apps/web/src/lib/db.ts` | Neon serverless pool + Drizzle instance |
| `apps/web/src/instrumentation.ts` | Sentry server + edge init |
| `apps/web/src/instrumentation-client.ts` | Sentry client init |
| `apps/web/src/app/global-error.tsx` | Sentry React render-error capture |
| `apps/web/next.config.js` | `withSentryConfig` wrap; deprecated options now under `webpack.*` |
| `apps/api/drizzle/0000_ambitious_absorbing_man.sql` | Sole DB migration; users/session/account/verification all defined here, all `uuid PRIMARY KEY NOT NULL` with no DB default — that is why `generateId` must be a function |
| `apps/api/src/db/seed-admin.ts` | Reference example of correct insert (uses explicit `randomUUID()`) |
