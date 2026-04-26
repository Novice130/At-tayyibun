# Session Handoff — 2026-04-25

> Paste this into a new Claude Code session as context. Covers everything built or fixed in the Apr 25 session: MFA redirect loop, login flow overhaul, profile setup wizard, browse gender filter, API error handling, and the graphify install.

---

## 1. Problems coming in (from Apr 24 handoff)

1. **Admin MFA keeps re-prompting** — after entering the OTP and passing verification, every admin page still showed the spinner and redirected back to `/admin/security/challenge`. Never reached the admin UI.
2. **Admin login not routing correctly** — the `twoFactorRedirect` check in `LoginForm.tsx` was fragile and could fail depending on how `twoFactorClient()` intercepted the response.
3. **Plain-text MFA email** — OTP email sent as `<p>Your code is <strong>484091</strong>. It is valid for 5 minutes.</p>`.
4. **No profile completion flow** — after signup users landed on `/browse` with no profile data.
5. **Browse shows all genders** — male users couldn't find female profiles (and vice versa) because no gender filter was applied, and also because `profileComplete = false` for all fresh signups.

---

## 2. Root causes diagnosed

### MFA redirect loop
`admin/layout.tsx` reads `(session as any)?.session?.twoFactorVerified`. Better-Auth's `get-session` endpoint does **not** include `twoFactorVerified` by default, even though the column exists in the DB session table. The field was always `undefined`, so `!twoFactorVerified` was always `true`, and the MFA gate was permanently active.

**Attempted but wrong:** `session.additionalFields.twoFactorVerified` in `auth.ts` — this extends the Drizzle schema mapping but does NOT cause the field to appear in the `get-session` JSON response for plugin-managed fields.

**Correct fix:** The `customSession` plugin with the options-pattern — this is the documented way for Better-Auth to pass plugin-added fields through `get-session`.

### Login fragility
`LoginForm.tsx` manually checked `data?.twoFactorRedirect` after `signIn.email()`. This is unreliable because `twoFactorClient()` may intercept and transform the response before it reaches the caller. The correct pattern is to configure `twoFactorPage` on the client plugin so redirection is handled automatically.

### API non-JSON error crash
`api.ts` called `response.json()` unconditionally. When the API server is not running (or NestJS returns a non-JSON 500), the response is HTML/plain-text — `JSON.parse("Internal Server Error")` throws `"Unexpected token 'I'"` and the app shows a cryptic error with no useful message.

---

## 3. Fixes applied

### `apps/web/src/lib/auth.ts`
- Restructured to the `options satisfies BetterAuthOptions` + `customSession` pattern:
  ```typescript
  const options = { ...all config... } satisfies BetterAuthOptions;
  export const auth = betterAuth({
    ...options,
    plugins: [
      ...(options.plugins ?? []),
      customSession(async ({ user, session }) => ({ user, session }), options),
    ],
  });
  ```
  Passing `options` as the second argument to `customSession` allows TypeScript to infer all plugin-added session fields (including `twoFactorVerified` from `twoFactor` plugin) and include them in the `get-session` response.
- Replaced bare HTML OTP email with a fully designed HTML email:
  - Cream background, dark navy card, gold OTP code box (42 px monospace)
  - Personalised greeting: "Assalamu Alaikum [firstName]"
  - Orange security-notice banner
  - Footer with `attayyibun.com` link
- Fixed `logger.onLog` → `logger.log` (TypeScript error in Better-Auth v1.1.13).
- Removed erroneous `session.additionalFields` block (replaced by `customSession`).

### `apps/web/src/lib/auth-client.ts`
- Configured `twoFactorClient` with `twoFactorPage`:
  ```typescript
  twoFactorClient({ twoFactorPage: "/admin/security/challenge" })
  ```
  Client now auto-redirects on 2FA challenge; LoginForm no longer needs manual check.

### `apps/web/src/app/login/LoginForm.tsx`
- Removed manual `data?.twoFactorRedirect` check (handled by plugin).
- Replaced `alert(err.message)` with inline red error banner (state-driven, no modal pop-up).
- Added `error` state + banner above the form fields.

### `apps/web/src/lib/api.ts`
- `fetchWithAuth` now:
  1. Wraps `fetch()` in try/catch → throws `{ message: "Cannot connect to server...", statusCode: 503 }` on network failure.
  2. Checks `content-type` header before calling `.json()` — if not JSON, reads as text and throws a clean error.
  3. Unwraps NestJS array validation messages: `Array.isArray(data.message) ? data.message.join(', ') : data.message`.
- Removed `console.log('API_URL configured as:', API_URL)` noise.

### `apps/web/src/app/browse/page.tsx`
- On mount, fetches `GET /profiles/me` to get the logged-in user's gender.
- Auto-applies `gender=FEMALE` (for male users) or `gender=MALE` (for female users) to every profile fetch.
- `handleFilter` preserves the gender lock when users apply ethnicity/age filters.
- **Men see only sisters' profiles; women see only brothers' profiles — always, no override.**

### `apps/web/src/app/profile/setup/page.tsx` *(new file)*
5-step profile completion wizard triggered after signup.

| Step | Fields |
|------|--------|
| 1 — Basic Info | First Name, Last Name (private/encrypted), Date of Birth (≥18 validated), Ethnicity, City, State (US dropdown), Hide-location checkbox |
| 2 — Background | Legal Status (Citizen / Permanent Resident / Visa-Holder), Education Level (select), Profession, Willingness to Relocate |
| 3 — Deen | Religious Practice (Practicing / Striving / Moderate), Prayer Frequency, Dietary Preferences (Zabiha / Halal / No Preference), Sect/School of Thought (optional) |
| 4 — About You | Describe the Candidate (bio), Partner Preferences, Deal-Breakers (optional) |
| 5 — Confirm | Summary + Nikah intent confirmation checkbox |

- On mount: pre-fetches `GET /profiles/me` → fills existing values + captures `gender` (set during signup).
- On submit: `PUT /profiles/me` — base fields go to profile columns; everything else in `biodata: Record<string, unknown>` (stored encrypted in `biodataJsonEnc`).
- Validation per step: required fields checked before advancing; DOB age-gated at 18.

### `apps/web/src/app/signup/SignupForm.tsx`
- Post-signup redirect changed from `/browse` → `/profile/setup`.
- Success message updated accordingly.

---

## 4. Profile visibility contract

| Layer | What is shown |
|-------|---------------|
| Public browse card (unauthenticated) | firstName, age, gender, ethnicity, city/state (or state-only if `hideLocation = true`), avatar (cartoon), bio excerpt ≤ 200 chars |
| Authenticated browse | Above + membershipTier |
| Full profile view (opposite-gender only) | Above + education, profession, legal status, deen fields, relocate, partnerPreferences, dealBreakers |
| Private — never exposed publicly | Full name (lastName encrypted), direct phone (guardian's phone shared only after info-request approval), real photos |

Only users whose `profileComplete = true` appear in browse results (set by the NestJS profiles service on first `PUT /profiles/me` with a firstName).

---

## 5. Graphify

Installed as a Claude Code skill from `https://github.com/safishamsi/graphify.git` (commit `8bed332ff4b0`).

Files written:
- `C:\Users\Syed Amer\.claude\plugins\marketplaces\graphify\` — cloned repo
- `C:\Users\Syed Amer\.claude\plugins\cache\safishamsi\graphify\8bed332ff4b0\` — active skill files
- `installed_plugins.json` + `known_marketplaces.json` — updated

Use `/graphify` in any Claude Code session to build a knowledge graph of a folder. Outputs:
- `graph.html` — interactive node/edge visualization
- `graph.json` — GraphRAG-ready JSON
- `GRAPH_REPORT.md` — plain-language audit summary

---

## 6. Known issue: API server must be running

The profile setup form and browse page both call the NestJS API at `http://127.0.0.1:3001` (proxied via Next.js `/api/*` rewrites). If the API isn't running, the proxy fails and the user sees "Cannot connect to server."

**Start both servers with:**
```bash
pnpm dev   # from monorepo root — runs web (3000) + api (3001) via Turborepo
```

Or separately:
```bash
cd apps/web && pnpm dev   # port 3000
cd apps/api && pnpm dev   # port 3001
```

**Auth requires a server restart** — `auth.ts` changes (customSession, email template, twoFactorPage) are read at startup.

---

## 7. Pending / next session

- [ ] **Confirm MFA loop is fixed** — log in as SUPER_ADMIN, verify OTP, confirm admin dashboard loads without re-prompting.
- [ ] **Profile form E2E test** — sign up as a new user, complete the 5-step wizard, verify profile appears in browse with correct opposite-gender filtering.
- [ ] **Profile card fields** — the browse `ProfileCard` component currently shows public fields only. Confirm `hideLocation` is respected (show state only, not city).
- [ ] **Rotate all secrets** (still pending from Apr 24 — Neon, Better-Auth secret, Resend API key, Sentry token). Do this before any production deploy.
- [ ] **Production deploy** — current production is pre-Apr 25 fixes. After smoke-testing locally, push and verify Dokploy deploys cleanly.
- [ ] **Graphify run** — run `/graphify` on the codebase to generate a knowledge graph. Output will be in the project root or a `graph/` folder.

---

## 8. Key files reference

| File | Purpose |
|------|---------|
| `apps/web/src/lib/auth.ts` | Better-Auth server config — customSession pattern, MFA email template |
| `apps/web/src/lib/auth-client.ts` | Better-Auth React client — twoFactorPage configured |
| `apps/web/src/lib/api.ts` | Fetch wrapper — now handles non-JSON responses gracefully |
| `apps/web/src/app/login/LoginForm.tsx` | Login form — inline error banner, no alert() |
| `apps/web/src/app/admin/layout.tsx` | Admin MFA gate — reads `session.session.twoFactorVerified` |
| `apps/web/src/app/admin/security/challenge/page.tsx` | OTP entry — sends once on mount via `useRef` guard |
| `apps/web/src/app/browse/page.tsx` | Browse — auto opposite-gender filter |
| `apps/web/src/app/profile/setup/page.tsx` | New: 5-step profile wizard |
| `apps/web/src/app/signup/SignupForm.tsx` | Redirects to /profile/setup after signup |
| `apps/api/src/modules/profiles/profiles.service.ts` | Profile upsert — `biodata` stored encrypted in `biodataJsonEnc` |
| `apps/api/src/modules/profiles/dto/index.ts` | UpdateProfileDto — accepts firstName/lastName/dob/gender/ethnicity/city/state/bio/biodata |
