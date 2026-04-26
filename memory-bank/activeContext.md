# Active Context — 2026-04-26

## Status
All known prod-blockers cleared. Auth + profile + admin flows verified
end-to-end via Playwright (`diagnostics/drive-admin-login.ts`).

## Last commit on `main`
`1bf42ac` — single OTP per challenge mount via module-scope flag.

## Open work
- Rotate prod secrets (Neon, BetterAuth, Resend, Sentry token).
- Decide whether to relax profile completion check (drops `bio` +
  `lastName` requirement) so partially-complete users like
  `testsister1@example.com` show up in browse.
- Re-enable Sentry on web after VPS upgrade (currently commented out).
- Regenerate `graphify-out/` after the DB driver swap.

## Where to start a new session
Read `docs/session-handoff-2026-04-26.md` — it's the canonical handoff
that absorbs the previous chunked notes. Do not consult the older
session-handoff files (they predate the consolidation and are
historical).
