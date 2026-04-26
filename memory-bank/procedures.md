# Procedures — At-Tayyibun

## Tail prod API logs for errors
```bash
docker service logs attayibun-api-nvxlws --tail 200 2>&1 \
  | grep -B2 -A30 -iE "error|exception" | tail -80
```

## Force-redeploy the API
```bash
docker service update --force attayibun-api-nvxlws
```

## Confirm the latest code actually shipped
```bash
docker service logs attayibun-api-nvxlws --tail 30 2>&1 \
  | grep -E "DrizzleService|node-postgres pool init"
```

## Drive admin login end-to-end (no email needed)
```bash
DATABASE_URL='<neon-pooler-url>' \
  pnpm --filter @at-tayyibun/web exec tsx \
    ../../diagnostics/drive-admin-login.ts
```
Reads OTP from the `verification` table and types it into headless
chromium. Use this to isolate backend vs browser the moment a 401
returns.

## Quick DB diagnostics
A reusable script lives at `diagnostics/check-state.ts`. Run with
`DATABASE_URL=... npx tsx diagnostics/check-state.ts`. Edit the
`sections` map to whatever queries the current bug needs.

## Reseed (clears + recreates everything)
```bash
pnpm --filter @at-tayyibun/api db:seed         # 20 test users
pnpm --filter @at-tayyibun/api db:seed:admin   # admin (idempotent)
```

## Local dev
```bash
pnpm dev   # web :3000 + api :3001 via Turborepo
```

## Browser MCP servers (configured)
- `playwright` — `npx -y @playwright/mcp@latest`
- `chrome-devtools` — `npx chrome-devtools-mcp@latest`
- `puppeteer` — `npx -y @modelcontextprotocol/server-puppeteer`
- `dokploy-mcp` — manages Dokploy apps without curl
- `memory-bank` — reads/writes this folder programmatically

`claude mcp list` to see status.
