# Progress — At-Tayyibun

## 2026-04-26 — Auth/DB stabilization marathon
Eight-layer bug chain resolved (full narrative in
`docs/session-handoff-2026-04-26.md`):

| Commit | Layer | What it fixed |
|---|---|---|
| `be7fa2d` | 0 | BetterAuth `generateId` string → function |
| `d0a1305` `cb5fb21` | 1 | Sentry OOM build → commented + heap cap |
| `7085143` `5422571` | 2 | Lazy GCS + Resend constructors |
| `51fe05b` | 3 | Strip cookie signature; seed `account` row |
| `747d3fd` | 4 | Persist gender from sign-up |
| `0ac7356` `a720aec` | 5 | Unblock 2FA challenge; session schema cols |
| `37dd401` | 6 | Drop neon-serverless WS → node-postgres TCP |
| `d1acac1` | 7 | RolesGuard stops checking phantom 2FA column |
| `c4b077a` `1bf42ac` | 8 | Single OTP per challenge mount |

Verification harness: `diagnostics/drive-admin-login.ts` drives the
admin sign-in + 2FA flow with an OTP read from the `verification` table,
so future regressions can be detected without an inbox.

## Lessons distilled
See `docs/session-handoff-2026-04-26.md` §5 — the canonical "do not
relearn this" list.
