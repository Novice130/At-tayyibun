# Admin Panel — Build Notes

Running log of decisions, gotchas, and rationale while building the admin panel. Written during implementation so future readers (or future me) skip re-deriving the same reasoning.

---

## Context at start

- Backend admin module (`apps/api/src/modules/admin/`) already ships: `/admin/analytics`, `/admin/users`, `/admin/users/:id`, `/admin/users/:id/boost`, `/admin/admins` (add/remove, SUPER_ADMIN), `/admin/settings` + `/admin/settings/membership` toggle. RBAC enforced via `RolesGuard` + `@Roles()` decorator.
- Frontend has **no** `/admin` route yet. Better-auth session exposes `user.id`, `user.email`, `user.name`, `user.image`, `user.publicId` — but **not** `user.role`. Role lives on the `User` table in Postgres.
- Admin seed creates `admin@attayyibun.com` / `ChitapataChinukulu`. First seed used argon2 hash → login failed. Switched seed to better-auth `hashPassword` (scrypt). Existing admin row rehashed via one-shot script.

## MVP slice (shipping this pass)

Three pages. Nothing fancy. Hits endpoints that already exist.

| Route | Purpose | Backend |
|---|---|---|
| `/admin` | Dashboard KPIs | `GET /admin/analytics` |
| `/admin/users` | List + detail + boost + role toggle | `GET /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id/boost`, `POST /admin/admins`, `DELETE /admin/admins/:id` |
| `/admin/settings` | Membership toggle + admin roster | `GET /admin/settings`, `PUT /admin/settings/membership` |

Guard: `RequireAdmin` client-side wrapper redirects USERs to `/browse`. Server-side role check already happens in NestJS via `RolesGuard` — frontend guard is UX only, not security.

## Decisions

### Expose `role` on session
Better-auth only surfaces fields listed in `additionalFields`. Need to add `role` there so the frontend can gate the nav link and the `/admin/*` pages without an extra round-trip. Writing `input: false` since role is not user-supplied.

### Route layout
Using `apps/web/src/app/admin/` (flat, no route group). Plan doc suggests `(admin)/admin/` but a route group adds no value here — no shared layout different from the rest of the app. If we later want a dedicated admin chrome (sidebar nav, no main site header), convert to a group then.

### Notes policy
This file. Append-only during each step. Short entries ok; the point is the why, not the play-by-play.

---

## Step 1 — Expose `role` on session ✓

[apps/web/src/lib/auth.ts](../apps/web/src/lib/auth.ts): added `role` to `additionalFields` next to `publicId`.

- `type: "string"` — `Role` is a Prisma enum but better-auth `additionalFields` only accepts primitives; string is fine since the enum values (`USER`, `ADMIN`, `SUPER_ADMIN`) are strings on the wire.
- `input: false` — clients can't set their own role via signup/update.
- `required: false` — legacy users without a role still load.

Frontend can now read `session.user.role` and compare to `'ADMIN' | 'SUPER_ADMIN'`.

---

## Step 2 — `/admin` layout + `RequireAdmin` guard ✓

[apps/web/src/app/admin/layout.tsx](../apps/web/src/app/admin/layout.tsx).

Decisions:
- Layout is a **client component**. Server gating via cookies would be nicer but the rest of the app already does client-side redirect patterns; keeping consistent avoids a one-off. Guard is UX only — backend `RolesGuard` is what actually protects data.
- Guard logic: if session loading → spinner; if no session → `/login`; if session but role not admin → `/browse`. Never render admin chrome for non-admins even for one frame.
- Sidebar is a fixed 64-col rail with logo, nav, user block. Uses the same CSS vars (`--color-bg`, `--color-surface`, `--color-border`) as the rest of the app so the theme toggle keeps working.
- Cast `(session.user as any).role` — better-auth types don't pick up `additionalFields` into the session type automatically in v1.1.x. Could chase a proper typed wrapper later; cast is fine for now.
- No mobile-nav yet. Admin use is desktop-heavy; dropping mobile saves a collapsible drawer component we'd just rebuild when the ad/coupon screens land.

---

## Step 3 — Dashboard page ✓

[apps/web/src/app/admin/page.tsx](../apps/web/src/app/admin/page.tsx).

- 4 KPI cards up top (total / verified / brothers / sisters) + membership tier breakdown with inline progress bars.
- Single `GET /admin/analytics` call on mount. No refresh button — analytics are aggregate counts, not real-time; reloading the page is fine for now. Add SWR + auto-refresh if admins ask.
- Using existing `.card` utility (see `globals.css`) and `--color-*` vars so dark/light themes both work.
- Icons are role-neutral (`Users` for both genders) — intentional; we're showing counts, not drawing gendered visuals.
- Progress-bar color for "Silver" tier is `bg-gray-400`. We don't have a silver palette token; not worth inventing one for a single bar.

---

## Step 4 — Users page ✓

[apps/web/src/app/admin/users/page.tsx](../apps/web/src/app/admin/users/page.tsx).

Layout: two columns on `lg+` — list on the left, detail aside sticky to top on the right. Collapses to a single column on smaller screens.

Decisions:
- **Row click selects, doesn't navigate.** Detail loads into the aside via a second `GET /admin/users/:id`. Keeps list scroll + search state intact while scanning multiple users.
- **Rank boost is a range input, committed on `mouseup`/`touchend`, not on every drag frame.** Firing a PUT on every pixel would hammer the API. Committed value reflects back into the row list.
- **Role controls are SUPER_ADMIN-gated on the frontend**, matching backend `@Roles(Role.SUPER_ADMIN)` on the `/admin/admins` endpoints. Non-super admins just see "SUPER_ADMIN only" — no broken buttons.
- **SUPER_ADMIN demotion is blocked** (matches backend `ForbiddenException`). We surface the rule in the UI rather than letting the user click and eat a 403.
- **Search is submit-on-enter**, not live-typing. Postgres `ILIKE` with `contains` on email + publicId + first name is cheap, but live search would still fire a query per keystroke — unnecessary for admin-scale workflows.
- Optimistic update on detail after boost/promote/demote so the drawer reflects the new state immediately; full list refresh runs in parallel to stay honest.
- Using inline `.card` class + CSS vars like elsewhere. No new components introduced; `RoleBadge` and `Row` are local because they're only used here.

---

## Step 5 — Settings page ✓

[apps/web/src/app/admin/settings/page.tsx](../apps/web/src/app/admin/settings/page.tsx).

Two sections:
1. **Paid memberships toggle** — SUPER_ADMIN only. Flips `system_config.membership_enabled` via `PUT /admin/settings/membership`. Read via `GET /admin/settings`.
2. **Admin roster** — lists every ADMIN + SUPER_ADMIN. Demote button for ADMINs (SUPER_ADMIN gated). Promote lives on the Users page detail drawer, with a one-line hint here.

Decisions:
- **Roster is built by client-side filter of `/admin/users?limit=200`.** No role-filter query param on the backend yet. Admins are <10 at scale, so over-fetching a page of 200 is fine. When Phase 6 adds `?role=` we'll swap.
- **Toggle widget is a hand-rolled pill** instead of pulling in a switch library. Styles match the gold palette and respect the disabled state when the viewer isn't SUPER_ADMIN.
- Optimistic removal of the demoted admin from the list; refetch-on-error would add complexity without user-visible value because the roster is tiny.
- No promote-from-here UI. Having two places to promote creates two flows to keep in sync. Promote happens on Users page detail (where you were scanning candidates); Settings is for the already-promoted roster.

---

## Step 6 — Admin nav link ✓

[apps/web/src/app/browse/page.tsx](../apps/web/src/app/browse/page.tsx): conditional `Admin` link (desktop + mobile menu) rendered only when `session.user.role ∈ {ADMIN, SUPER_ADMIN}`.

- Only wired into the `browse` navbar for now. Other pages (`profile`, `requests`, `messages`) duplicate the same nav markup and should get the same link — but that's low-value copy-paste vs. admins reaching `/admin` by direct URL. Defer until we extract a shared `<Navbar />` component.
- Uses `Shield` icon + gold color to make the link stand out from regular nav items — it's a mode-switch, not another user-facing page.
