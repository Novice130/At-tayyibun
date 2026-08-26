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

### BUG 2: Signup page client-side exception (FIXED & COMMITTED)
- **Symptom:** "Application error: a client-side exception has occurred" on attayyibun.com/signup showing `BetterAuthError: Invalid base URL: /auth`.
- **Root Cause & Fix:** The `auth-client.ts` file provided a relative `"/auth"` string to the `baseURL` property. BetterAuth's URL parser requires an absolute URL. Updated `auth-client.ts` to dynamically assemble an absolute URL using `window.location.origin` or `process.env.NEXT_PUBLIC_WEB_URL`.

### BUG 3: Infinite Redirect Loop on Successful Login / Signup (FIXED)
- **Symptom:** After creating a profile, the user redirects to `/browse` but then is immediately thrown backwards into `/login`.
- **Root Cause:** The Next.js frontend pages (`/browse`, `/profile`) and API wrapper (`api.ts`) were still relying on legacy `localStorage.getItem('accessToken')` checks instead of listening for the new HTTP-only session cookies established by BetterAuth.
- **Fix applied:** Stripped out legacy `localStorage` checks. Upgraded `/browse` and `/profile` to gracefully use BetterAuth's `useSession()` hook. Injected `credentials: 'include'` into `api.ts` requests.

### BUG 4: Local `npm run dev` script fails with "cannot find binary path" (FIXED)
- **Symptom:** Running `npm run dev` crashes Turbo with `Unable to find package manager binary`.
- **Root Cause:** Bumping Next.js and the tech stack also updated the `packageManager` declaration in `package.json` to `pnpm@9`. Because `corepack` lacked permissions locally, Turbo couldn't resolve the `pnpm` binary.
- **Fix applied:** Installed `pnpm` explicitly as a root local `devDependency`. Now running `npm run dev` correctly resolves `node_modules/.bin/pnpm` and correctly hydrates the Next.js and NestJS servers. Node_modules successfully restored.

### BUG 5: Web Docker Build Fails on Alpine during argon2 compilation (FIXED)
- **Symptom:** Dokploy web deployment fails at `pnpm install` step with `node-gyp ERR! stack Error: Could not find any Python installation to use` on `argon2` install.
- **Root Cause:** In hoisted node-linker mode, root `pnpm install` installs dependencies across all workspaces including `@at-tayyibun/api` (which depends on `argon2`). `Dockerfile.web` only had `libc6-compat` in the `deps` stage, missing `python3 make g++`.
- **Fix applied:** Updated `Dockerfile.web` line 8 to `RUN apk add --no-cache libc6-compat python3 make g++`, identical to `Dockerfile.api`.

---

## Dokploy Config & Credentials
- **Platform:** dokploy.learnnovice.com
- **Project:** "Attayibun"
- **Web app ID:** kR_VYSPSAMuzU6peeBtt9 (Dockerfile.web, port 3000)
- **API app ID:** 9E23qdq8WrdmisgYgis94 (Dockerfile.api, port 3001)
- **Domain:** attayyibun.com (web: path `/`, API: path `/api`)
- **GitHub:** Novice130/At-tayyibun, branch `main`, auto-deploy on push

## Admin & Auth Setup (2026-08-26)
- **Admin account:** `admin@attayyibun.com` (Role: `SUPER_ADMIN`)
- **Admin password:** Updated in database with scrypt hash
- **Admin Single Concurrent Session:** Implemented via `databaseHooks.session.create.after` in `apps/web/src/lib/auth.ts`. When an admin logs in on a new device/browser, all older active sessions for that admin account are automatically invalidated from the database so previous users are signed out instantly.
- **2FA:** Google Authenticator (TOTP) + Email OTP + Backup Codes enabled on `/admin/security/challenge`.
- **Apple Sign-In (Web & Mobile):** Configured with Apple Client ID & Client Secret in Dokploy environment and live on production.
- **Google OAuth Web & Mobile:** Fixed server client ID to `659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com` across mobile builds and Dokploy.
- **Mobile Post-Verification Avatar Flow:** When users sign in via Google/Apple/Phone, `/verify-phone` automatically routes them to the interactive Brother/Sister avatar picker (`/profile/avatar?initial=true`) before opening `/browse`.
- **TestFlight Releases:** Automated via `apps/mobile/scripts/upload_to_testflight.sh`. Latest build uploaded: `0.1.3+6` (App ID: `6805307609`, Bundle ID: `com.attayyibun.attayyibun`).
- **Avatars:** 42 curated avatars (21 male, 21 female from `Images_New/`) deployed to production.

## Key Technical Notes
- `node-linker=hoisted` in `.npmrc` means ALL dependencies live in root `node_modules`. Workspace subdirectory `node_modules` folders are empty/nonexistent. Both Dockerfiles require `python3 make g++` in `deps` stage for native modules.
- Traefik routes `/api/*` to the API container and everything else to the web container. BetterAuth had to move to `/auth` to avoid being routed to the API.

---

## iOS Mobile App Parity & TestFlight Release Plan

### 1. Feature Parity Status (iOS App vs Web)
- **Google Sign-In + Phone Gate**: Integrated with `google_sign_in`. If user logs in with Google and lacks verified phone, `router.dart` intercepts and routes directly to `/verify-phone`.
- **Default Country Code**: Defaulted to `+1 ` (US) in `initState` across `VerifyPhoneScreen` and `SignupScreen`.
- **American Phone Number Spacing**: `formatPhoneInput` automatically formats digits into `+1 XXX XXX XXXX` (3 digits, 3 digits, 4 digits).
- **Avatars**: 42 curated avatars (21 male, 21 female from `Images_New/`) dynamically loaded via `presetAvatars(gender)` from `https://attayyibun.com/avatars/`.
- **OTP Input**: Clean 6-digit input without digit clipping.
- **Email Verification**: Bypassed; signup proceeds directly to phone SMS verification.

### 2. TestFlight Configuration & Rollout Before App Store Production
Before submitting the app for public App Store Review and release, configure and test via Apple **TestFlight**:

1. **Prerequisites & Signing:**
   - Ensure Apple Developer Team and Bundle ID (`com.attayyibun.at_tayyibun`) are configured with an App Store Distribution Provisioning Profile.
   - Verify `GoogleService-Info.plist` and `Info.plist` URL schemes (`REVERSED_CLIENT_ID` for Google OAuth and `app-1-637715249195-ios-...` for Firebase Phone reCAPTCHA / APNs).

2. **Build & Archive for TestFlight:**
   ```bash
   cd apps/mobile
   flutter build ipa --release
   ```
   Or archive via Xcode: `Product > Archive > Distribute App > App Store Connect > Upload`.

3. **Internal Testing on TestFlight:**
   - Add internal team testers in App Store Connect under **TestFlight > Internal Testing**.
   - Builds become available to internal testers immediately upon processing (no Apple review required).
   - Test critical end-to-end flows:
     - Google OAuth sign-in → Phone OTP verification.
     - Email registration → Phone OTP verification → Avatar picker → Profile browsing.
     - American phone number formatting (`+1 XXX XXX XXXX`).

4. **External Beta Testing (Optional):**
   - Add external tester groups in TestFlight.
   - Requires lightweight beta app review from Apple (~24-48 hours).

5. **Final Production Release:**
   - Once TestFlight testing passes without regressions, select the verified build in **App Store Connect > App Store tab > Build** and submit for final App Store review.


