# Deployment Lessons Learned — Dokploy + pnpm workspace

Date: 2026-04-19
Scope: At-Tayyibun API (NestJS) + Web (Next.js) on Dokploy

---

> **SECURITY UPDATE (2026-08-13):** All secrets previously exposed in the working
> tree (Neon password, BETTER_AUTH_SECRET, ENCRYPTION_KEY, Resend keys, Sentry token,
> Android keystore passwords) were scrubbed to placeholders and are now **awaiting
> rotation** — see `docs/SECURITY-ROTATION.md` for the checklist. Treat every old value
> as compromised until rotated.

---

## Symptoms observed

- Dokploy dashboard showed an endless cycle of deployments, each ending in `Cancelled`.
- Container status stayed `running` (old image still served traffic) — so there was no crash, but no new code ever landed.
- Build logs froze at pnpm install progress:
  ```
  #19 15.38 Progress: resolved 0, reused 0, downloaded 54, added 40
  #19 212.2 Progress: resolved 0, reused 0, downloaded 60, added 43
  ```
  ~200-second gap with almost no progress → build timed out → Dokploy cancelled → auto-triggered the next one → loop.
- Dokploy logs tab showed `Error response from daemon: No such container: select-a-container`. That's a UI placeholder, not a runtime error — it just means no container was picked in the log dropdown.

## Root causes

### 1. `.dockerignore` too thin
Original file only excluded a handful of temp patterns. `COPY . .` in the `builder` stage shipped:
- Host `node_modules/` (hoisted pnpm tree, potentially GBs on Windows with junctions)
- `.git/`, `.next/`, `dist/`, logs, screenshots, env files

Effect: huge build context upload to BuildKit + collisions with the image's own `node_modules` + secret env files could leak into the image.

### 2. Parallel `pnpm install` thrash
BuildKit runs independent stages concurrently. Both `deps` and `prod-deps` stages started `pnpm install --frozen-lockfile` at the same time, each pulling the full workspace tree.

On a small Dokploy VPS this caused:
- Network contention (two pnpm registries downloading in parallel).
- Disk I/O thrash (hoisted linker writes a single big tree; two writers fight each other).
- Occasional OOM / slow-down → pnpm stalls for minutes.

The 200s stall in the logs is exactly this.

### 3. Wasteful double install
The `prod-deps` stage re-installed the entire workspace from scratch (just with `--prod`) instead of reusing the `deps` layer. That's the slower path and the one that triggered the parallel-install problem in the first place.

### 4. Dokploy autoDeploy + manual re-deploys stacked
`autoDeploy: true` + repeated manual "Rebuild" / MCP-triggered deploys piled up in the queue. Each new deploy cancelled the in-progress one, so nothing ever ran to completion. 11 deployments in a row were `Cancelled` for this reason — only 1 was an actual `error` status.

### 5. Secrets leaked via the Dokploy API
The Dokploy MCP `application-one` endpoint returned the full GitHub App private key, OAuth client secret, webhook secret, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, and the Neon DB URL (with password) in plaintext in the response body. Anything pulling that endpoint gets the full set. **Rotate all of these.**

---

## Fixes applied

### `.dockerignore`
Rewritten to exclude `node_modules`, build output, git, env files, logs, and binaries. Keeps build context small and avoids shipping host state into the image.

### `Dockerfile.api`
- Single install in the `deps` stage.
- `builder` now `FROM deps` — reuses the installed tree, no second install.
- `prod-deps` now `FROM deps` and runs `pnpm --filter=@at-tayyibun/api deploy --prod --legacy /out` to emit a slim, production-only `node_modules` for the runner. The `--legacy` flag is required because `.npmrc` sets `node-linker=hoisted`.
- `pnpm config set network-concurrency 4` before install — caps parallel network sockets so a small VPS doesn't stall.
- `--prefer-offline` added so pnpm reads its own cache first when layers are reused.

### `Dockerfile.web`
- Same pattern: single `deps` stage, `builder FROM deps`, concurrency 4, `--prefer-offline`.
- Runner stays standalone-output based — no node_modules copy needed, so this one was already close to correct.

### Dokploy settings
- `autoDeploy` turned off until builds are green, to stop new pushes from piling up the queue.

---

## Lessons — keep these rules

1. **`.dockerignore` is load-bearing.** Always exclude `node_modules`, VCS, build output, env files, and logs. Check it before debugging slow builds.
2. **Never run two `pnpm install` in parallel inside one Docker build.** BuildKit *will* parallelize independent stages. Serialize pnpm work by making downstream stages `FROM <prev>` instead of `FROM node:...`.
3. **Throttle pnpm on small VPS.** `pnpm config set network-concurrency 4` (or lower). Default 16 overwhelms modest network/CPU.
4. **Use `pnpm deploy --prod`** instead of re-installing for prod-only. With hoisted linker, pass `--legacy`. Much faster, smaller image, cache-friendly.
5. **Distinguish `Cancelled` from `Error` in Dokploy.** A cancel spiral means the queue is piling up, not that the code is broken. Flush the queue, disable autoDeploy, run one build to completion, then re-enable.
6. **Don't trust `No such container: select-a-container` as an error message.** It's Dokploy's dropdown placeholder — pick an actual container in the log viewer.
7. **Treat the Dokploy API as a secret-leak surface.** `application-one` returns raw env + GitHub App private key. Rotate anything that has ever been returned from it, and prefer scoped-read access if the platform ever exposes it.
8. **Commit lockfile + `.npmrc` together.** Image builds use `--frozen-lockfile`; if `.npmrc` sets a non-default `node-linker`, the image install behavior changes and every tooling choice downstream (pnpm deploy flags, prune behavior) must account for it.

---

## Next deploy sequence (recommended)

1. Confirm autoDeploy is OFF.
2. In Dokploy → Deployments → **Clear deployments** + **Cancel Queues** to flush backlog.
3. Commit these changes (`.dockerignore`, `Dockerfile.api`, `Dockerfile.web`) and push.
4. Hit **Deploy** manually once. Watch the logs — expect:
   - `deps` stage finishes pnpm install once.
   - `builder` and `prod-deps` reuse deps layer (fast).
   - Runner layer is small.
5. Once green, flip autoDeploy back ON.
6. **Rotate all secrets leaked via Dokploy API** (GitHub App key, OAuth client secret, webhook secret, BETTER_AUTH_SECRET, ENCRYPTION_KEY, Neon DB password).

---

## iOS launch additions (2026-08-20)

9. **The Apple OAuth client secret expires — silently, every 6 months.** Apple caps the
   ES256 client-secret JWT at 180 days. When it lapses, *every* Sign in with Apple
   attempt fails at once with an opaque `invalid_client`, on both web and iOS, with
   nothing in our logs pointing at expiry. Regenerate with
   `corepack pnpm --filter api apple:secret` (needs `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
   `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY`) and re-inject `APPLE_CLIENT_SECRET` into both
   containers. Keep a calendar reminder at the 5-month mark — App Store Guideline 4.8
   makes a broken Apple login a removal risk, not just a bug.
10. **`pnpm` is not on PATH on the build machine — use `corepack pnpm`.** A bare `pnpm`
    fails, and `pnpm add` inside this workspace has hit
    `ERR_PNPM_INCLUDED_DEPS_CONFLICT`, which invites hand-editing `package.json`. That
    leaves `pnpm-lock.yaml` stale and the Docker build dies on `--frozen-lockfile`.
    After any dependency edit, run `corepack pnpm install` at the repo root and commit
    the lockfile in the same change.
11. **`drizzle-kit generate` needs a TTY against this introspected schema.** Migrations
    `0001` and `0002` are hand-written for that reason. The runtime migrator only reads
    `drizzle/meta/_journal.json` plus the SQL files, so a hand-written migration with a
    journal entry applies normally on the next API deploy — no snapshot required.
