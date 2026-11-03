# Marital status, children and "open to" matching

Date: 2026-10-27. Status: design, awaiting owner approval.

## Why

Members who are divorced, widowed or have children need a fair way to find people who are open to them. Members who are
not open to that should never be shown such profiles, instead of finding out
late. At the same time, a member's marital history and children are sensitive:
the owner does not want them displayed on profiles or browse cards. They are
revealed only to the person who receives a request from that member.

## What the member sees

### Profile setup and edit (web and mobile, shipped together)

Three new questions, part of the regular profile form (owner's decision: not a
separate step, page or settings screen). On web they sit in the existing
profile setup wizard (`apps/web/src/app/profile/setup/page.tsx`), placed with
the other personal questions on an existing step (builder picks which), and
appear in the Confirm summary. On mobile they sit in the edit-profile form
(`apps/mobile/lib/screens/edit_profile_screen.dart`). Because they are part of
the profile form, editing the profile later edits them too.

1. **My marital status** (required, single choice):
   - Never married
   - Divorced
   - Widowed

   There is no "Married" option for anyone (owner's decision, 2026-10-27): the
   platform serves US members, where a second marriage is illegal, so only
   unmarried members may use it. The form says so next to the question
   ("Attayyibun is for members who are not currently married"), and
   `apps/web/src/app/terms/page.tsx` gets the same sentence. (Wording is the
   designer's call.)
2. **Do you have children?** (required, Yes / No). If Yes: **How many?**
   (optional, whole number 1-20).
3. **Who are you open to?** (checkboxes, all optional, none ticked by default):
   - Someone who is divorced
   - Someone who is widowed
   - Someone who has children

Copy on the section says plainly that these answers are private: they are
never shown on the profile or in browse, and are shown only to someone the
member sends a request to.

### Browse (web `apps/web/src/app/browse/page.tsx`, mobile `browse_screen.dart`)

No new visible filter, label, badge or sort. Browse silently returns only
profiles that are compatible **both ways** (see Matching rule). Nothing in the
API response for browse or for a single profile view
(`GET /api/profiles/:publicId`) includes the other member's marital status,
children or open-to answers.

### Requests (web `apps/web/src/app/requests/page.tsx`, mobile `requests_screen.dart`)

On an **incoming** request, the receiver sees the requester's marital status
and children, e.g. "Divorced · 2 children", "Never married · No children",
"Widowed · No children". Shown for every requester, whatever their status, so
the presence of the line reveals nothing by itself. Not shown on outgoing
requests (the requester already knows their own status). The requester never
sees the receiver's answers through this feature.

The requester's open-to answers are never shown to anyone.

## Matching rule

For viewer V and candidate C (already filtered to the opposite gender, profile
complete, not blocked, as today), C is shown only if both are true:

- C is acceptable to V: `acceptable(V.openTo, C)`
- V is acceptable to C: `acceptable(C.openTo, V)`

`acceptable(openTo, person)` is true when every one of these holds:

- person.maritalStatus is `NEVER_MARRIED`, or
  - `DIVORCED` and openTo includes divorced, or
  - `WIDOWED` and openTo includes widowed
- person.hasChildren is false, or openTo includes has children

Examples: a never-married sister with no children and nothing ticked sees only
never-married brothers with no children who are open to her (everyone is open
to never-married with no children). A divorced brother with 2 children is seen
only by sisters who ticked both "divorced" and "has children", and only sees
sisters he is open to.

When browse is called without a signed-in viewer (if that path exists today),
show only `NEVER_MARRIED` + no children profiles: the safest default, and it
leaks nothing.

Sending a request is allowed only when the pair is compatible both ways; the
create-request endpoint re-checks the rule so it cannot be bypassed by calling
the API with a publicId found elsewhere. (Designer's call.)

Single profile view (`GET /api/profiles/:publicId`, designer's call): for a
signed-in viewer, an incompatible pair gets the same 404 as a block, unless an
info request (any status) exists between the two members, so links from the
requests page keep working. Anonymous visitors are unchanged: they can't send
requests and never see the new fields.

Inference (accepted by the owner, 2026-10-27): a member can toggle their own
open-to answers and watch who appears or disappears in browse, and so infer
others' status. The owner accepted this when choosing silent matching. Every
change to a member's own status or open-to answers is written to `audit_logs`
(action `profile.marital_prefs_updated`, no values in metadata) so abuse can
be spotted. No cooldown in this change.

Requests and later changes (designer's call):
- The receiver sees the requester's status and children as they are now, not
  as they were when the request was sent. No snapshot columns.
- A pending request that stops matching because either side changed answers
  (or at launch) is left alone; the receiver can still approve or decline it.
  Only creating a new request re-checks the rule.

## Existing members

The site is pre-launch: existing members are few and mostly test or casual
accounts, and the mobile app is not in the stores yet (owner, 2026-10-27). So:

- The two status questions (marital status, children yes/no) are required.
  The server rejects completing a profile without them; no compatibility path
  for old app builds is needed.
- An existing member whose answers are empty is sent to the profile form right
  after signing in (web and mobile) and cannot browse or send requests until
  they answer. (Designer's call on the "prompt at login" the owner asked for.)
- Until they answer, the matching rule treats them as Never married, no
  children, open to nobody beyond that; since they are blocked from browsing,
  this only affects whether others see them.

## Data

Stored in plain (unencrypted) columns on `profiles`, because browse must filter
on them in SQL and the encrypted biodata blob cannot be queried:

- `marital_status`: new enum `MaritalStatus` (`NEVER_MARRIED`, `DIVORCED`,
  `WIDOWED`), nullable (null = not answered yet, treated as
  `NEVER_MARRIED` by the matching rule)
- `has_children`: boolean, nullable (null treated as false)
- `children_count`: smallint, nullable
- `open_to_divorced`, `open_to_widowed`, `open_to_children`: boolean, not
  null, default false

Server-side validation: `marital_status` accepts only the three values above
(no married value exists, so the API cannot be used to set one);
`children_count` only when `has_children` is true.

These columns must never be added to `publicFields`, to browse or profile-view
responses, to `PUBLIC_BIODATA_KEYS`, or to admin CSV exports beyond what admins
already see. Admin profile views may show them.

### Migration

Hand-written Drizzle migration following 0001-0004 (see
`apps/api/drizzle/`), additive only (new enum + nullable / defaulted columns),
so older api images keep working against the new schema and `bin/prod rollback`
stays safe.

Branch (designer's call): `feat/marital-status` from `bc346a7` (= `origin/main`).
The uncommitted photo-drop work (`0005_drop_legacy_photos.sql`, its rollback
script, and its edits to `schema.ts`, `relations.ts`, `seed.ts`, the journal and
three comment-only files) is first set aside with `git stash push -- <those
paths>` so it does not leak into this branch; it is restored afterwards and
renumbered as below. The plan stops at merge to main plus a check on
staging.attayyibun.com; the owner deploys to production with `bin/prod deploy`.

Ordering with the pending, uncommitted `0005_drop_legacy_photos`: this feature
ships first, so it takes `0005_marital_status`, and the photos drop is renamed
to `0006_drop_legacy_photos` with a journal `when` greater than this one's.
Journal `when` values must increase in merge order, because the migrator only
applies entries newer than the last applied one. Migrations run automatically
on api start (staging on merge to main, production on `bin/prod deploy`).

## Non-goals

- No visible marital-status filter, sort, badge or label anywhere in browse.
- No change to who can see contact details, or to the request approval flow.
- No "open to" preferences for other attributes (age range, ethnicity) in this
  change.
- No backfill guessing of existing members' status.

## Anti-goals (would make this a failure even if it works)

- Any API response that lets a member read another member's marital status or
  children outside of an incoming request they received.
- A member ever seeing a profile of someone who ruled them out.
- A migration that breaks the currently running production image.

## Left to the builder

- Exact UI layout, step placement and wording beyond the meaning above.
- Whether the matching rule is a SQL expression in `browseProfiles` or a
  shared helper; it must be one implementation used by browse and
  create-request.
- Indexes (likely unnecessary at current size).
- Tests: unit tests for the matching rule (all status x children x open-to
  combinations that matter), API tests that browse and profile-view responses
  contain none of the new fields, and that incoming requests do.
- Mobile model/repository changes needed to read and write the new fields.
