#!/bin/bash
# diagnostics/check-prod-schema.sh
# Compares local drizzle schema SQL generation against prod DB without modifying anything.
# Safe read-only check. Must be run from apps/api/

set -e

echo "=== Step 1: Generate local schema SQL (dry-run) ==="
pnpm exec drizzle-kit generate --force 2>&1 | tail -20

echo ""
echo "=== Step 2: Inspect prod schema (read-only introspect) ==="
# Use a read-only Neon connection or temporary check
# This outputs the actual tables/columns in production
echo "To introspect prod directly, run:"
echo "  DATABASE_URL=<prod-neon-url> pnpm exec drizzle-kit introspect 2>&1 | head -100"
echo ""
echo "=== Step 3: Push schema to prod (DESTRUCTIVE) ==="
echo "⚠️  DRY RUN ONLY — run with --dry-run first"
echo "  DATABASE_URL=<prod-neon-url> pnpm exec drizzle-kit push --force"
echo ""
echo "=== Recommended: Take Neon branch backup first ==="
echo "1. Go to Neon console → Branching → Create branch from main"
echo "2. Use new branch URL as DATABASE_URL for testing"
echo "3. If clean, switch prod URL to new branch"
echo ""
echo "=== Common failure patterns ==="
echo "1. profiles.lastNameEnc column missing in prod → INSERT fails"
echo "2. profiles.biodataJsonEnc column missing in prod → INSERT fails"
echo "3. profiles.publicFields jsonb missing → hideLocation not stored"
echo "4. users.rank_boost integer missing → ORDER BY fails"
echo "5. session.expiresAt type mismatch → session lookup fails"