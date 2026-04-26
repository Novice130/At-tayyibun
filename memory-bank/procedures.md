# Procedures — At-Tayyibun

## Deploy API Fix
```bash
docker service update --force attayibun-api-nvxlws
```

## Check API Logs
```bash
docker service logs attayibun-api-nvxlws --tail 50 -f 2>&1 | Select-String "DrizzleService|Neon|ws available|error|ERROR"
```

## Check Container Status
```bash
docker service ls | grep attayibun-api
docker service ps attayibun-api-nvxlws --no-trunc | head -3
```

## Force-Redeploy (pulls latest main)
```bash
docker service update --force attayibun-api-nvxlws
# Then immediately watch logs:
docker service logs attayibun-api-nvxlws --tail 30 -f
```

## Test Health Endpoint
```bash
curl -s https://attayyibun.com/api/admin/analytics -H "cookie: better-auth.session_token=<token>"
```

## Check Neon DB Two-Factor Records
```sql
SELECT u.email, u.two_factor_enabled, t.id as two_factor_id
FROM users u LEFT JOIN two_factor t ON t."userId" = u.id
WHERE u.email = 'admin@attayyibun.com';

SELECT "userId", COUNT(*) as cnt FROM two_factor GROUP BY "userId" HAVING COUNT(*) > 1;
```

## Sign Out and Clear 2FA
1. Sign in as admin → goes to challenge page
2. Disable 2FA via `/admin/security/setup`
3. Re-enable 2FA fresh

## Local Dev
```bash
cd apps/api && pnpm dev  # port 3001
cd apps/web && pnpm dev  # port 3000
```