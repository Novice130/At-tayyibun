# At-Tayyibun Deployment Notes

## Last Updated: 2026-04-07

---

## What's Working

- **Web app (Next.js)** is LIVE at attayyibun.com
- Dockerfile.web: fixed for hoisted node-linker (pnpm), standalone mode works
- Dockerfile.api: builds successfully (4-stage: deps → build → prod-deps → runner)
- Auth routing: BetterAuth moved from `/api/auth` to `/auth` (avoids Traefik routing conflict)
- Login/signup pages: wrapped with `next/dynamic` + `ssr: false` to prevent build-time static generation errors
- API env vars in Dokploy: ENCRYPTION_KEY, NODE_ENV, API_PORT, WEB_URL all configured
- Both Docker images build successfully on Dokploy

---

## What Was Done (All Changes)

### Docker & Deployment
- `Dockerfile.web` — fixed for hoisted deps (`node-linker=hoisted` means only root `node_modules` exists), standalone output mode
- `Dockerfile.api` — simplified from broken symlink hack to clean 4-stage build (deps → builder → prod-deps → runner)
- `pnpm-workspace.yaml` — removed non-existent `packages/*` and `jobs/*` entries that broke `pnpm install`
- `.npmrc` — `node-linker=hoisted` (was already set, key to understanding all Docker issues)

### Auth Routing
- `apps/web/src/lib/auth.ts` — added `basePath: "/auth"`
- `apps/web/src/lib/auth-client.ts` — changed `baseURL` to `"/auth"`
- `apps/web/src/app/auth/[...all]/route.ts` — moved handler from `/api/auth/` to `/auth/` (Traefik was routing `/api/*` to the API container, so BetterAuth requests never reached the web container)

### SSR Fix
- `apps/web/src/app/login/page.tsx` — thin wrapper with `dynamic(() => import('./LoginForm'), { ssr: false })`
- `apps/web/src/app/login/LoginForm.tsx` — extracted client component
- `apps/web/src/app/signup/page.tsx` — thin wrapper with `dynamic(() => import('./SignupForm'), { ssr: false })`
- `apps/web/src/app/signup/SignupForm.tsx` — extracted client component

### Avatar Selection Feature
- Added 12 male avatars to `apps/web/public/avatars/male/male-1.jpg` through `male-12.jpg` (~35KB each)
- Added 12 female avatars to `apps/web/public/avatars/female/female-1.jpg` through `female-12.jpg` (~35KB each)
- `apps/web/src/app/signup/SignupForm.tsx` — two-step signup flow: form → avatar selection grid. Gender choice determines which avatar set is shown. Selected avatar path is sent as `image` field in `signUp.email()`.

### Config
- `apps/web/next.config.js` — added `output: 'standalone'`, configurable API URL via `INTERNAL_API_URL` env var, fixed `removeConsole` to preserve `console.error` and `console.warn` in production

### Bug Fixes
- Replaced `next/image` `Image` component with plain `<img>` in SignupForm avatar grid (standalone mode missing `sharp` dependency caused client-side crash)
- Fixed `removeConsole` — was stripping ALL console methods including `console.error`/`console.warn` that libraries depend on. Now only removes `console.log`.
- Compressed avatar images from ~9MB PNGs to ~35KB JPEGs (git push was failing due to 171MB total)

---

## Outstanding Bugs

### BUG 1: API returns 502 (CRITICAL)
- **Symptom:** attayyibun.com/api/* returns Cloudflare 502. Docker build passes, Dokploy shows "done", but container produces NO runtime logs at all.
- **Impact:** Signup, login, and all API-dependent features are broken. The web UI loads but can't create accounts or authenticate.
- **What's been tried:**
  1. Added debug CMD to Dockerfile.api to print diagnostic output — no logs appeared
  2. Stripped wrapping quotes from Dokploy env values (ENCRYPTION_KEY etc.)
  3. Slimmed image with production-only deps stage
  4. All builds succeed — the container appears to crash before Node.js even starts
- **Likely causes:**
  - EncryptionService crashing on startup due to ENCRYPTION_KEY format (this throws synchronously on NestJS module instancing).
  - Lack of a top-level `try/catch` in `bootstrap()` meant that `NestFactory` initialization failures just silently crashed the process with no log output captured by Dokploy.
- **Next steps to try:**
  1. ~~Test Docker build locally with `docker build -f Dockerfile.api .` and `docker run` to see actual error~~
  2. ~~Temporarily disable EncryptionService to isolate if it's the crash source~~
  3. Added explicit `try/catch` to `main.ts` and logged explicit error output in `EncryptionService` constructor. Await deploy and check Dokploy logs. If it logs `ENCRYPTION_KEY must be a 32-byte hex string`, the key in Dokploy needs to be updated.

### BUG 2: Signup page client-side exception (LIKELY FIXED — needs verification)
- **Symptom:** "Application error: a client-side exception has occurred" on attayyibun.com/signup
- **Fix applied:** Replaced `next/image` with plain `<img>` tags, fixed `removeConsole` config. Committed and pushed (990ca9e). Awaiting deploy.
- **Verify:** Visit attayyibun.com/signup after deploy completes. The form and avatar selection should render. Account creation will still fail until Bug 1 is fixed.

---

## Dokploy Config
- **Platform:** dokploy.learnnovice.com
- **Project:** "Attayibun"
- **Web app ID:** kR_VYSPSAMuzU6peeBtt9 (Dockerfile.web, port 3000)
- **API app ID:** 9E23qdq8WrdmisgYgis94 (Dockerfile.api, port 3001)
- **Domain:** attayyibun.com (web: path `/`, API: path `/api`)
- **GitHub:** Novice130/At-tayyibun, branch `main`, auto-deploy on push

## Key Technical Notes
- `node-linker=hoisted` in `.npmrc` means ALL dependencies live in root `node_modules`. Workspace subdirectory `node_modules` folders are empty/nonexistent. This is critical for Docker COPY steps.
- Previous AI made 5 failed deployment attempts — root cause was not understanding hoisted mode.
- Traefik routes `/api/*` to the API container and everything else to the web container. BetterAuth had to move to `/auth` to avoid being routed to the API.
