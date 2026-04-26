# Active Context — At-Tayyibun 2026-04-26 Evening

## Current Problem
**WebSocket connection to Neon DB failing inside Docker container.**
All API endpoints returning 500 because `BetterAuthGuard` can't look up sessions.

## Root Cause
```
Error: All attempts to open a WebSocket to connect to the database failed.
Details: TypeError: fetch failed
at BetterAuthGuard.canActivate
```
Docker container cannot reach Neon WebSocket endpoint (port 5432/SSL).

## Fix Applied (commit `878290c`)
- `better-auth.guard.ts`: try-catch on DB lookup → 503 fallback
- `drizzle.service.ts`: neonConfig ws tuning + startup log

## Pending Actions
1. Force deploy: `docker service update --force attayibun-api-nvxlws`
2. Check startup log for `[DrizzleService] Neon WebSocket pool initialized. ws available:`
3. If still failing → fix Docker DNS or switch Neon to HTTP mode
4. Test OTP login flow
5. Test admin analytics endpoint
6. Test profile setup wizard

## Environment
- Prod API: `attayibun-api-nvxlws` on Dokploy VPS
- Neon DB: cloud.neon.tech
- Web app: Next.js on Dokploy
- SMTP: Resend (RESEND_API_KEY set in Dokploy)