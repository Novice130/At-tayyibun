# Session Handoff — 2026-04-26 (Evening Session — NVIDIA AI)

> Centralized memory file. All findings, fixes, and next steps consolidated here.
> This is the SOURCE OF TRUTH for this session.

---

## 🔴 CRITICAL: WebSocket Connection Failure in Docker (ROOT CAUSE)

**Symptom**: EVERYTHING returns 500. API, admin, profiles — all fail.
**Actual error from docker logs**:
```
Error: All attempts to open a WebSocket to connect to the database failed.
Details: TypeError: fetch failed
at BetterAuthGuard.canActivate (/dist/.../better-auth.guard.js:37:21)
```
**Location**: Every request that hits `BetterAuthGuard.canActivate()` → DB lookup fails → throws → becomes 500.
**This cascades to**: `GET /api/admin/analytics`, `PUT /api/profiles/me`, `POST /auth/two-factor/verify-otp` — ALL fail because they all need DB access through the session guard.

### Why it happens
Docker container cannot open WebSocket connections to Neon DB (port 5432/443). The `ws` package is installed in the container, but the underlying WebSocket handshake fails with `fetch failed` — likely DNS or outbound WebSocket blocked by Dokploy Docker network policy.

### Fixes applied (commit `878290c`)
1. **`better-auth.guard.ts`**: Wrapped DB session lookup in try-catch → returns 503 "Authentication service temporarily unavailable" instead of crashing the request
2. **`drizzle.service.ts`**: Added `neonConfig` tuning: `pipelineConnect: false`, `fetchTimeout: 10000`, `maxMessageSize`. Also added startup log: `[DrizzleService] Neon WebSocket pool initialized. ws available: true/false`
3. **`main.ts`**: `AllExceptionsFilter` already registered ✅
4. **`email.service.ts`**: Already lazy-loaded ✅ (commit `5422571`)

### What you need to do RIGHT NOW
```bash
# Deploy the fix
docker service update --force attayibun-api-nvxlws

# Then check startup logs for this message:
docker service logs attayibun-api-nvxlws --tail 30 2>&1
# Look for: [DrizzleService] Neon WebSocket pool initialized. ws available: true
```

If `ws available: false` → `ws` package missing from Docker image → check Dockerfile.

If `ws available: true` but still `fetch failed` → Docker network cannot reach Neon WebSocket endpoint. Fix options:
1. Use Neon HTTP endpoint instead of WebSocket (set `pool_mode=session` or use neon HTTP driver)
2. Configure Docker daemon DNS for Neon hosts
3. Check Dokploy Docker network mode (host vs bridge)

---

## 2. OTP 401 — Two-factor verify-otp failing

**Symptom**: Admin receives OTP email but `POST /auth/two-factor/verify-otp` returns `401`.

**Root cause**: The 401 is a **consequence of the WebSocket failure** above. The `BetterAuthGuard` was throwing `UnauthorizedException` wrapped in a 500 because DB lookup failed. Now with the guard fix (try-catch → 503), the actual 401 would surface differently.

**If after WebSocket fix the OTP still 401**: Check Neon DB:
```sql
-- Check admin's twoFactor state
SELECT u.id, u.email, u.two_factor_enabled, t.id as two_factor_id
FROM users u LEFT JOIN two_factor t ON t."userId" = u.id
WHERE u.email = 'admin@attayyibun.com';

-- Check for duplicate twoFactor rows (causes issues)
SELECT "userId", COUNT(*) as cnt FROM two_factor GROUP BY "userId" HAVING COUNT(*) > 1;
```

If duplicate or missing → disable 2FA via `/admin/security/setup` and re-enable.

---

## 3. Files Changed This Session

| File | Change | Commit |
|---|---|---|
| `apps/api/src/modules/admin/admin.service.ts` | try-catch in getAnalytics | `dd73367` |
| `diagnostics/check-prod-schema.sh` | New diagnostic script | `dd73367` |
| `apps/api/src/common/guards/better-auth.guard.ts` | try-catch on DB lookup → 503 fallback | `878290c` |
| `apps/api/src/db/drizzle.service.ts` | neonConfig ws tuning + startup log | `878290c` |
| `docs/nvidia-ai-changes-2026-04-26.md` | This file | `878290c` |

---

## 4. Architecture Reminders

- **WebSocket in Docker**: Dokploy containers may block outbound WebSocket to Neon → use HTTP fallback or fix DNS
- **twoFactorVerified column**: better-auth never writes it — non-null session IS proof
- **Constructor-throws-on-missing-env**: Always lazy-load SDKs (learned 3 times now)
- **AllExceptionsFilter**: Already registered in `main.ts` ✅

---

## 5. Dummy Accounts

| Email | Password | Role | 2FA |
|---|---|---|---|
| admin@attayyibun.com | (see local memory `reference_test_accounts.md`) | SUPER_ADMIN | Email OTP |
| ahmad0@example.com | Test@123 | USER | None |

---

## 6. MCP Tools Configured

See `~/.gemini/antigravity/mcp_config.json`:
- `chrome-devtools-mcp` — browser inspection at `http://127.0.0.1:9222`
- `dokploy-mcp` — Dokploy VPS management
- `sentry` — error tracking
- `playwright-mcp` — E2E testing (AVAILABLE via npx, add to config to use)

---

## 7. Deploy Commands

```bash
# Force-redeploy API (pulls latest main)
docker service update --force attayibun-api-nvxlws

# Watch logs
docker service logs attayibun-api-nvxlws --tail 50 -f

# Check container startup
docker service logs attayibun-api-nvxlws --tail 30 2>&1 | Select-String "DrizzleService|Neon|ws available"
```

---

## 8. Test Plan (after deploy)

### Test 1: API health
```bash
curl -s https://attayyibun.com/api/health 2>&1 | head -5
```

### Test 2: Admin analytics (should not 500)
```bash
# Login as admin, get session cookie, then:
curl -s https://attayyibun.com/api/admin/analytics \
  -H "cookie: better-auth.session_token=<token>" | head -20
```

### Test 3: Playwright E2E (after adding to MCP config)
```bash
npx @playwright/mcp --browser chromium --url https://attayyibun.com/admin
```

---

## 9. Next Steps (Priority Order)

1. [ ] **Force deploy `878290c`** → `docker service update --force attayibun-api-nvxlws`
2. [ ] **Check startup log** for `[DrizzleService] Neon WebSocket pool initialized. ws available:`
3. [ ] **If ws=false**: Fix Dockerfile to include `ws` package properly
4. [ ] **If ws=true but still fails**: Switch Neon to HTTP mode or fix Docker DNS
5. [ ] **Test admin login** → should reach challenge page → receives OTP
6. [ ] **Test OTP verify** → should land on `/admin` dashboard (no 500)
7. [ ] **Test `/api/admin/analytics`** → should return JSON not 500
8. [ ] **Test fresh signup** → profile wizard → complete → lands on browse (no 500)

---

## 10. Memory Bank Centralization

Central memory files:
- `docs/session-handoff-2026-04-26.md` — open problem + full context
- `docs/nvidia-ai-changes-2026-04-26.md` — THIS FILE — tonight's findings + fixes
- `docs/session-handoff-2026-04-25b.md` — previous session details
- `diagnostics/check-prod-schema.sh` — schema drift diagnostic

When creating new session handoffs, merge all findings into the most recent file.
Delete or archive older files to keep memory bank lean.