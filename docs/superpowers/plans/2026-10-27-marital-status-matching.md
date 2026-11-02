# Marital Status Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members record marital status, children and who they are open to; browse silently shows only two-way-compatible members; the status is revealed only on the receiver's incoming-request card.

**Architecture:** Plain columns on `profiles` (hand-written Drizzle migration 0005). One matching module in the api (pure functions + a SQL condition builder) used by browse, single-profile view and create-request. Profile completeness now requires the two status answers, which sends existing members back to the profile form and keeps them out of browse until they answer. Web wizard and Flutter edit screen gain the fields; request cards on both show the line.

**Tech Stack:** NestJS 10 + Drizzle ORM + Postgres 17 (Neon), Jest; Next.js 15 (React, TypeScript); Flutter (Dart, Riverpod).

**Spec:** `docs/superpowers/specs/2026-10-27-marital-status-matching-design.md`

## Global Constraints

- Branch `feat/marital-status` (already created from `bc346a7`). The photo-drop work is in `stash@{0}`; do not touch it.
- Enum `MaritalStatus` values exactly: `NEVER_MARRIED`, `DIVORCED`, `WIDOWED`. No married value anywhere (API, DB, UI).
- Labels exactly: `Never married`, `Divorced`, `Widowed`. Open-to labels: `Someone who is divorced`, `Someone who is widowed`, `Someone who has children`.
- Notice next to the status question, exactly: `Attayyibun is for members who are not currently married.`
- Privacy copy under the section, exactly: `These answers are private. They are never shown on your profile or in browse, only to a member you send a request to.`
- Request-card line format: `<Label> · <children>` where children is `No children`, `1 child`, `<n> children`, or `Has children` when the count is empty.
- `children_count` range 1-20; stored only when `has_children` is true, otherwise null.
- The new fields must never appear in `publicFields`, `PUBLIC_BIODATA_KEYS`, browse responses or `GET /api/profiles/:publicId` responses. Only `GET /api/profiles/me` (owner) and incoming requests carry them.
- Migration journal entry: idx 5, tag `0005_marital_status`, `when` `1792000000000` (must stay below the stashed photo-drop's `1793000000000`).
- Repo is public: no secrets in code, tests or fixtures.
- Commits: the owner commits only on request. Each task's commit step runs only after the owner has said commits on this branch are OK; never push.
- API checks: `cd apps/api && npx jest`, `npx tsc --noEmit -p tsconfig.json`, `npx eslint "src/**/*.ts"` (pnpm may be missing from PATH; use `node_modules/.bin`). Web: `cd apps/web && npx tsc --noEmit && npx eslint .`. Mobile: `cd apps/mobile && flutter analyze && flutter test`.

## Review Focus

1. A partial `PUT /profiles/me` (the signup seed sends only `firstName` + `gender`) must leave existing marital fields untouched: `undefined` means "not sent", only explicit values change columns. Test in Task 3.
2. A signed-in viewer whose own profile is incomplete or has null marital fields calls browse: they get a 403 `PROFILE_INCOMPLETE`, not a 500 and not unfiltered results. Test in Task 4.
3. `hasChildren: false` sent together with `childrenCount: 3` stores `children_count = null`. Test in Task 3.
4. The receiver of a request changes their open-to answers so the pair no longer matches; opening the requester's profile from the requests page still returns 200 because a request row exists (any status). Test in Task 4.
5. An incoming request whose requester has no profile row (deleted mid-flight) still lists without throwing; `profile` stays null. Test in Task 5.

---

### Task 1: Schema and migration

**Files:**
- Modify: `apps/api/src/db/schema.ts` (enum near line 5; `profiles` table)
- Create: `apps/api/drizzle/0005_marital_status.sql`
- Modify: `apps/api/drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `maritalStatus` pgEnum `"MaritalStatus"`; `profiles` columns `maritalStatus` (`marital_status`, nullable), `hasChildren` (`has_children`, boolean nullable), `childrenCount` (`children_count`, smallint nullable), `openToDivorced` / `openToWidowed` / `openToChildren` (`open_to_divorced` / `open_to_widowed` / `open_to_children`, boolean not null default false).

- [ ] **Step 1: Add the enum and columns to `schema.ts`** using `pgEnum("MaritalStatus", ['NEVER_MARRIED','DIVORCED','WIDOWED'])` and `smallint` from `drizzle-orm/pg-core`.
- [ ] **Step 2: Write `0005_marital_status.sql`** in the style of 0004 (header comment, `--> statement-breakpoint` between statements, idempotent):
  - `DO $$ BEGIN CREATE TYPE "public"."MaritalStatus" AS ENUM('NEVER_MARRIED','DIVORCED','WIDOWED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`
  - six `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS ...` matching Step 1
  - `UPDATE "profiles" SET "profile_complete" = false WHERE "marital_status" IS NULL;` with a comment: pre-launch, existing members must answer before they reappear in browse (spec, Existing members).
- [ ] **Step 3: Add the journal entry** (idx 5, version "7", when 1792000000000, tag `0005_marital_status`, breakpoints true).
- [ ] **Step 4: Typecheck** — `npx tsc --noEmit -p tsconfig.json` in `apps/api`. Expected: no errors.
- [ ] **Step 5: Apply to the staging database only** — `cd apps/api && npx nest build && MIGRATION_DATABASE_URL="$(cat ~/.cache/attayyibun-staging/stg-direct.url)" node dist/src/migrate.js`. Expected: `[migrate] up to date`; then `psql "$(cat ~/.cache/attayyibun-staging/stg-direct.url)" -c '\d profiles'` lists the six columns. Run it a second time: still exit 0. Never point this at production.
- [ ] **Step 6: Commit** (after owner OK) — `git add apps/api/src/db/schema.ts apps/api/drizzle && git commit -m "feat(api): add marital status columns to profiles"`

### Task 2: Matching module

**Files:**
- Create: `apps/api/src/modules/profiles/marital-match.ts`
- Test: `apps/api/src/modules/profiles/marital-match.spec.ts`

**Interfaces:**
- Consumes: Task 1 columns via `profiles` from `../../db/schema`.
- Produces:
  - `export type MaritalStatus = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED'`
  - `export const MARITAL_STATUSES: readonly MaritalStatus[]`
  - `export interface MatchSide { maritalStatus: MaritalStatus | null; hasChildren: boolean | null; openToDivorced: boolean; openToWidowed: boolean; openToChildren: boolean }`
  - `export const DEFAULT_SIDE: MatchSide` (all null / false; used for anonymous viewers)
  - `export function toMatchSide(row: Partial<MatchSide> | null | undefined): MatchSide` (fills defaults)
  - `export function isAcceptable(openTo: MatchSide, person: MatchSide): boolean`
  - `export function isMutualMatch(a: MatchSide, b: MatchSide): boolean`
  - `export function mutualMatchSql(viewer: MatchSide): SQL` — a Drizzle `sql` condition over `profiles` columns that is true exactly when `isMutualMatch(viewer, candidateRow)` would be; nulls handled with `COALESCE(marital_status,'NEVER_MARRIED')` and `COALESCE(has_children,false)`.

- [ ] **Step 1: Write the failing tests** in `marital-match.spec.ts`:
  - `isAcceptable(DEFAULT_SIDE, side('NEVER_MARRIED', false))` → true
  - `isAcceptable(DEFAULT_SIDE, side('DIVORCED', false))` → false; with `openToDivorced: true` → true
  - `isAcceptable(DEFAULT_SIDE, side('WIDOWED', false))` → false; with `openToWidowed: true` → true
  - `isAcceptable(DEFAULT_SIDE, side('NEVER_MARRIED', true))` → false; with `openToChildren: true` → true
  - `isAcceptable({...openToDivorced only}, side('DIVORCED', true))` → false (children also needs its box)
  - null status / null children count as `NEVER_MARRIED` / no children
  - `isMutualMatch` is false when only one direction accepts; true when both do; symmetric (`isMutualMatch(a,b) === isMutualMatch(b,a)`) over every combination of status {null, three values} × children {null,false,true} × the three boxes (loop, 4×3×8 per side)
  - `mutualMatchSql(viewer)` renders (via `new PgDialect().sqlToQuery`) with params that include no raw user text, and for `DEFAULT_SIDE` the SQL requires `NEVER_MARRIED` and no children
- [ ] **Step 2: Run** `npx jest marital-match` → FAIL (module not found).
- [ ] **Step 3: Implement** the exports above. `mutualMatchSql` builds "candidate acceptable to viewer" from the viewer's booleans as constants, and "viewer acceptable to candidate" from the viewer's own status/children selecting the candidate's `open_to_*` columns (viewer `DIVORCED` → `open_to_divorced`, `WIDOWED` → `open_to_widowed`, has children → `open_to_children`).
- [ ] **Step 4: Run** `npx jest marital-match` → PASS.
- [ ] **Step 5: Commit** (after owner OK) — `feat(api): add two-way marital matching rule`

### Task 3: Profile write path

**Files:**
- Modify: `apps/api/src/modules/profiles/dto/index.ts` (`UpdateProfileDto`)
- Modify: `apps/api/src/modules/profiles/profiles.service.ts` (`updateMyProfile` ~line 290, `getMyProfile` ~line 241)
- Modify: `apps/api/src/modules/profiles/profiles.controller.ts` (pass new fields through to the service)
- Modify: `apps/api/src/modules/profiles/profiles.module.ts` only if `AuditService` is not already injectable there (it is injected in `RequestsService`; mirror that)
- Test: `apps/api/src/modules/profiles/profiles.service.spec.ts`

**Interfaces:**
- Consumes: `MaritalStatus`, `MARITAL_STATUSES` (Task 2).
- Produces: `UpdateProfileDto` optional fields `maritalStatus?: MaritalStatus`, `hasChildren?: boolean`, `childrenCount?: number | null`, `openToDivorced?: boolean`, `openToWidowed?: boolean`, `openToChildren?: boolean`; `getMyProfile().profile` gains the same six keys (owner view only).

- [ ] **Step 1: Write failing tests** in `profiles.service.spec.ts` (same mock style as the file):
  - `updateMyProfile` with `{ maritalStatus: 'DIVORCED', hasChildren: true, childrenCount: 2, openToChildren: true }` writes `marital_status='DIVORCED'`, `has_children=true`, `children_count=2`, `open_to_children=true` to the update payload
  - `{ hasChildren: false, childrenCount: 3 }` → payload `childrenCount: null`
  - `{ firstName: 'A', gender: 'FEMALE' }` (partial seed) → payload contains none of the six keys (Review Focus 1)
  - completeness: all old required fields present but `maritalStatus` null after update → `profileComplete: false`; with `maritalStatus` and `hasChildren` set → `true`
  - any of the six keys present → `auditService.log` called once with `action: 'profile.marital_prefs_updated'` and metadata without the values; none present → not called
  - `getMyProfile` returns the six keys from the row
- [ ] **Step 2: Run** `npx jest profiles.service` → new tests FAIL.
- [ ] **Step 3: Implement.** DTO: `@IsOptional() @IsIn(MARITAL_STATUSES)`, `@IsBoolean()`, `@IsInt() @Min(1) @Max(20)` (allow null via `@ValidateIf(o => o.childrenCount !== null)`). Service: extend the `data` type, set columns only when `!== undefined`, clear `childrenCount` when the resulting `hasChildren` is not true, add `maritalStatus` and `hasChildren !== null` to the `isComplete` expression (using stored values when not sent), include the fields in the insert branch, log the audit entry after a successful write. Do not add any of them to `publicFields`.
- [ ] **Step 4: Run** `npx jest profiles.service` → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.
- [ ] **Step 5: Commit** (after owner OK) — `feat(api): save marital status and open-to answers`

### Task 4: Enforce matching in browse, profile view and create-request

**Files:**
- Modify: `apps/api/src/modules/profiles/profiles.service.ts` (`browseProfiles`, `getProfileByPublicId`)
- Modify: `apps/api/src/modules/requests/requests.service.ts` (`createRequest`)
- Test: `apps/api/src/modules/profiles/profiles.service.spec.ts`, Create: `apps/api/src/modules/requests/requests.service.spec.ts` (if none exists; follow the profiles spec's mock style)

**Interfaces:**
- Consumes: `MatchSide`, `DEFAULT_SIDE`, `toMatchSide`, `isMutualMatch`, `mutualMatchSql` (Task 2).
- Produces: browse throws `ForbiddenException({ code: 'PROFILE_INCOMPLETE' })` for a signed-in viewer whose profile is missing or `profileComplete` is false; web and mobile key off that code (Tasks 7, 8).

- [ ] **Step 1: Write failing tests:**
  - browse, signed-in viewer with `profileComplete: false` → rejects with `ForbiddenException`, code `PROFILE_INCOMPLETE` (Review Focus 2)
  - browse, signed-in complete viewer → the where clause includes `mutualMatchSql(viewerSide)` (assert via the mocked query builder receiving it, as the existing browse test inspects calls)
  - browse, anonymous → uses `mutualMatchSql(DEFAULT_SIDE)`
  - browse response items contain none of `maritalStatus`, `hasChildren`, `childrenCount`, `openTo*`
  - `getProfileByPublicId`, signed-in viewer, not a mutual match, no request row → `NotFoundException`
  - same but an `info_requests` row exists between them in either direction (any status) → 200 (Review Focus 4)
  - `getProfileByPublicId` response contains none of the new keys
  - `createRequest` when requester `profileComplete` is false → `BadRequestException('Please complete your profile before sending a request.')`
  - `createRequest` when not a mutual match → `NotFoundException('User not found')` (same message as a block)
- [ ] **Step 2: Run** the two specs → new tests FAIL.
- [ ] **Step 3: Implement.** Extend the existing viewer lookup in `browseProfiles` (it already selects the viewer's gender) to select completeness and the five match fields; add `mutualMatchSql` to `conds`. In `getProfileByPublicId`, after the block check, load the viewer's profile and, if not a mutual match, check for any `info_requests` row between the two users before throwing 404. In `createRequest`, after the block check, require `requester.profile.profileComplete` and `isMutualMatch`.
- [ ] **Step 4: Run** both specs → PASS; full `npx jest` → PASS; typecheck and lint clean.
- [ ] **Step 5: Commit** (after owner OK) — `feat(api): match browse, profile view and requests both ways`

### Task 5: Status on incoming requests

**Files:**
- Modify: `apps/api/src/modules/requests/requests.service.ts` (`getIncomingRequests` ~line 251)
- Test: `apps/api/src/modules/requests/requests.service.spec.ts`

**Interfaces:**
- Produces: each incoming item's `requester.profile` gains `maritalStatus: MaritalStatus | null`, `hasChildren: boolean | null`, `childrenCount: number | null`. `getOutgoingRequests` and `getActiveRequest` unchanged.

- [ ] **Step 1: Write failing tests:** incoming item for a divorced requester with 2 children carries those three values; outgoing items carry none of them; a requester with no profile row yields `profile: null` without throwing (Review Focus 5).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** by adding the three fields to the requester profile object.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** (after owner OK) — `feat(api): show requester marital status on incoming requests`

### Task 6: Web profile form and terms

**Files:**
- Modify: `apps/web/src/app/profile/setup/page.tsx`
- Modify: `apps/web/src/app/terms/page.tsx` (~line 38, next to "marital history")
- Create: `apps/web/src/lib/marital.ts`

**Interfaces:**
- Consumes: API fields from Task 3.
- Produces (`apps/web/src/lib/marital.ts`): `MARITAL_OPTIONS: { value: 'NEVER_MARRIED'|'DIVORCED'|'WIDOWED'; label: string }[]`; `formatMaritalLine(status: string | null, hasChildren: boolean | null, childrenCount: number | null): string | null` (null when status is null; format per Global Constraints).

- [ ] **Step 1: Add `marital.ts`** with the exports above.
- [ ] **Step 2: Extend `FormData`/`EMPTY`** with `maritalStatus: ''`, `hasChildren: '' | 'yes' | 'no'`, `childrenCount: ''`, `openToDivorced/openToWidowed/openToChildren: false`.
- [ ] **Step 3: Render the fields on step 1 ("Background & Life")**, after Willingness to Relocate: status radio/select from `MARITAL_OPTIONS` with the exact notice; children Yes/No with an optional number input (1-20) shown on Yes; the three open-to checkboxes with exact labels; the exact privacy copy.
- [ ] **Step 4: Validation** in `validate()` step 1: `'Marital status is required.'`, `'Please tell us whether you have children.'`, count outside 1-20 → `'Number of children must be between 1 and 20.'`.
- [ ] **Step 5: Submit and hydrate.** Send the six fields as top-level keys in the existing `api.put('/profiles/me', …)` at final submit (`hasChildren` boolean, `childrenCount` number or null). Hydrate them from `p`. Replace the placeholder-trust condition `p.profileComplete ? …` for `ethnicity`/`dob` with `const wizardDoneBefore = p.profileComplete || !!p.bio;` so existing members flipped to incomplete by migration 0005 keep their saved dob and ethnicity.
- [ ] **Step 6: Confirm summary** (step 4): add `SummaryRow`s "Marital status" (`formatMaritalLine`) and "Open to" (comma list or "Never married, no children only"), both marked `private`.
- [ ] **Step 7: Terms**: add the exact notice sentence near "marital history".
- [ ] **Step 8: Verify** `npx tsc --noEmit && npx eslint .` in `apps/web` → clean. Manually: `pnpm --filter web dev` against staging is not required; Task 9 checks in the browser.
- [ ] **Step 9: Commit** (after owner OK) — `feat(web): ask marital status and open-to in the profile form`

### Task 7: Web requests card and incomplete-profile handling

**Files:**
- Modify: `apps/web/src/app/requests/page.tsx` (incoming card ~lines 201-226; `RequestProfile` type ~line 19)
- Modify: `apps/web/src/app/browse/page.tsx` (~line 85, existing redirect)

**Interfaces:**
- Consumes: `formatMaritalLine` (Task 6); incoming `requester.profile` fields (Task 5); browse 403 `PROFILE_INCOMPLETE` (Task 4).

- [ ] **Step 1: Incoming card** shows `formatMaritalLine(...)` under the ethnicity/location line when non-null. Outgoing cards unchanged.
- [ ] **Step 2: Browse**: if the browse request fails with status 403 and code `PROFILE_INCOMPLETE`, `router.replace('/profile/setup')` (the existing `!profile?.profileComplete` redirect stays).
- [ ] **Step 3: Verify** typecheck + lint in `apps/web` → clean.
- [ ] **Step 4: Commit** (after owner OK) — `feat(web): show requester marital status on incoming requests`

### Task 8: Mobile app

**Files:**
- Modify: `apps/mobile/lib/models/profile.dart` (`ProfileDetails`)
- Modify: `apps/mobile/lib/models/info_request.dart` (counterparty profile)
- Modify: `apps/mobile/lib/repositories/profiles_repository.dart` (`update`)
- Create: `apps/mobile/lib/core/marital.dart`
- Modify: `apps/mobile/lib/screens/edit_profile_screen.dart`
- Modify: `apps/mobile/lib/screens/requests_screen.dart` (~line 403)
- Modify: `apps/mobile/lib/screens/browse_screen.dart` (~line 87)
- Test: `apps/mobile/test/core/marital_test.dart`

**Interfaces:**
- Consumes: Task 3 owner fields, Task 5 request fields, Task 4 `PROFILE_INCOMPLETE`.
- Produces (`marital.dart`): `const kMaritalOptions = <(String value, String label)>[...]`; `String? formatMaritalLine(String? status, bool? hasChildren, int? childrenCount)` with the same output as the web helper.

- [ ] **Step 1: Write failing test** `marital_test.dart`: `formatMaritalLine('DIVORCED', true, 2)` → `'Divorced · 2 children'`; `('NEVER_MARRIED', false, null)` → `'Never married · No children'`; `('WIDOWED', true, 1)` → `'Widowed · 1 child'`; `('WIDOWED', true, null)` → `'Widowed · Has children'`; `(null, null, null)` → `null`.
- [ ] **Step 2: Run** `flutter test test/core/marital_test.dart` → FAIL.
- [ ] **Step 3: Implement `marital.dart`**, add the six fields to `ProfileDetails` (+ `fromJson`), the three request fields to the info-request profile model, and the six optional named params to `ProfilesRepository.update` (same `'key': ?value` style).
- [ ] **Step 4: Edit screen**: fields in the same order and copy as web (exact notice and privacy text), validation messages identical to Task 6, sent in `_save()`. Apply the same placeholder-trust fix as web at ~line 91 (`p.profileComplete || (p.bio?.isNotEmpty ?? false)`).
- [ ] **Step 5: Requests screen** shows the line on incoming items only; **browse screen**: on an API error with status 403 and code `PROFILE_INCOMPLETE`, navigate to the edit-profile route used in `router.dart` (~line 82).
- [ ] **Step 6: Run** `flutter test && flutter analyze` → PASS / no issues.
- [ ] **Step 7: Commit** (after owner OK) — `feat(mobile): marital status, open-to and request line`

### Task 9: End-to-end check on staging

**Files:** none.

- [ ] **Step 1: Full checks** from repo root: api jest, api + web typecheck and lint, `flutter test` and `flutter analyze` → all pass.
- [ ] **Step 2: Owner gate.** Report results and ask the owner to push `feat/marital-status` and merge to `main` (Dokploy auto-deploys staging on push to main). Do not push yourself.
- [ ] **Step 3: After the owner merges**, wait for the staging deploy, then on https://staging.attayyibun.com with two fresh test accounts (one brother, one sister):
  - sister: Never married, no children, nothing ticked; brother: Divorced, 1 child, open to nothing → neither sees the other in browse
  - sister ticks divorced and children → both now see each other
  - brother sends a request → sister's incoming card shows `Divorced · 1 child`; brother's outgoing card shows no line
  - `curl -s https://staging.attayyibun.com/api/profiles/<brotherPublicId>` and the browse JSON contain none of the new keys
  - an existing staging account with null answers is sent to `/profile/setup` from `/browse`
- [ ] **Step 4: Report** what passed, with the observed strings, and hand production deploy to the owner (`bin/prod deploy attayyibun <sha>`; migration 0005 is additive plus the completeness update).
