# Progress — At-Tayyibun

## 2026-04-26 Evening (NVIDIA AI Session)

### Fixes Applied ✅
| Commit | Change | Status |
|---|---|---|
| `dd73367` | Diagnostic try-catch in `getAnalytics` | Deployed |
| `878290c` | BetterAuthGuard DB fallback; neonConfig ws tuning | Deployed |

### Root Cause Identified ✅
WebSocket connection to Neon DB failing inside Docker. All 500s are cascading from this.

### Files Changed
- `apps/api/src/modules/admin/admin.service.ts` — try-catch logging
- `apps/api/src/common/guards/better-auth.guard.ts` — DB fallback → 503
- `apps/api/src/db/drizzle.service.ts` — ws tuning + startup log
- `diagnostics/check-prod-schema.sh` — schema drift check script
- `docs/nvidia-ai-changes-2026-04-26.md` — consolidated memory file
- `docs/session-handoff-2026-04-26.md` — open problem tracker
- `memory-bank/` — NEW: centralized memory system

## 2026-04-25 Session
- `7085143`: hideLocation fix, lazy StorageService
- `51fe05b`: seed credential accounts
- `747d3fd`: persist gender from signup
- `0ac7356`: unblock MFA challenge
- `9a13698`: slim API Docker image
- `5422571`: lazy-construct Resend

## Lessons Learned
1. Constructor-throws-on-missing-env → always lazy-load SDKs
2. Old container image → force-update after env changes
3. WebSocket in Docker → test Neon connectivity from container
4. twoFactorVerified column → better-auth never writes to it