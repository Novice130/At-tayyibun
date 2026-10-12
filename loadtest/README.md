# Load tests for At-Tayyibun (Locust + Faker)

Staging only. The rules are in `GUIDE.md`; read it first. Nothing here has been run
against a real site yet: the code was written before staging existed.

## Files

| File | What it is |
|---|---|
| `locustfile.py` | The user classes: `Visitor`, `SignUp`, `Member`, `Moderation` |
| `races.py` | Separate locustfile with the race cases (`RaceUser`) |
| `common.py` | Shared code: staging guard, headers, fake people, account pool, response checker |
| `requirements.txt` | Pinned `locust` and `faker` (need Python 3.11 or newer) |
| `accounts.jsonl` | The account pool. Built by `SignUp`. Gitignored. Holds live session cookies |
| `results/` | Reports and CSVs. Gitignored |
| `NOTES.md` | One entry per session |

## Safety built in

- The host must be exactly `https://staging.attayyibun.com`. Anything else stops the run
  before a request is sent (checked at start-up, again at test start, and again when each
  user is created).
- Redirects are never followed, so a redirect cannot send a request to another host.
- Every request carries `X-Loadtest-Run: <run id>`. Set `LOADTEST_RUN_ID=baseline-1` to
  choose it; otherwise a timestamp is used. Use it to find the run in server logs.
- Emails end `@loadtest.invalid`; phones are `+1<area>55501NN`. The pool loader refuses a
  file that holds any other email.
- Targets for requests, blocks and reports come from `accounts.jsonl` only, never from
  browse results. Response bodies of profiles are never printed or saved.
- Each `Member`/`Moderation` user holds its own account. If there are more users than
  accounts, the run stops with a message instead of sharing one.

## Setup on the VM

```sh
cd /opt/loadtest/attayyibun
/opt/loadtest/venv/bin/pip install -r loadtest/requirements.txt
set -a; . /opt/loadtest/.env; set +a     # CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
export LOADTEST_RUN_ID=smoke-1           # optional
mkdir -p results
L="/opt/loadtest/venv/bin/locust -f loadtest/locustfile.py --host https://staging.attayyibun.com"
```

Always name the class. `-u` is users, `-r` is users started per second, `-t` is duration.
At the end of each run a summary prints the 429 counts (and race outcomes).

## What must be true on staging first

- The site answers at `https://staging.attayyibun.com` and the Cloudflare Access service
  token in the env is accepted.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are **unset** on
  staging. If they are set, stop: phone verification cannot be automated.
- `RESEND_API_KEY` is unset (no real email). Reports also email `ADMIN_EMAIL`, so they are
  off unless you set `LOADTEST_REPORTS=1`.
- `BETTER_AUTH_URL` (or `WEB_URL`) is the staging address. The trusted-origins list in
  `apps/web/src/lib/auth.ts` has no staging entry, so sign-up depends on this.
- `WEB_URL` on the API is the staging address (the CSRF Origin check).
- The owner has decided about the rate limits (kept, or raised on staging by a reviewed
  change). As shipped, expect many 429s under load.
- The Neon `staging` branch is awake; open the site once before measuring.
- Nothing else is running on the machine (one site at a time).

## Journeys

| Class | Journey | What it does |
|---|---|---|
| `Visitor` | A | Pages `/`, `/about`, `/login`, `/signup`; `/api/session/health`; a pool profile preview (must have `isFullView: false`, no `biodata`, no private fields) |
| `SignUp` | B | Sign up, `session/me`, check the 403 phone gate, verify a fake phone, save the profile, add the account to the pool. One account per 10 seconds at most |
| `Member` | C, D | Browse (three calls together), view a pool profile, inbox, send a request to a pool account then cancel it |
| `Moderation` | E | Block a pool account, see it listed, see its profile answer 404, unblock; optional report |
| `RaceUser` (in `races.py`) | D races | Double post, approve against cancel, approve against deny, each fired as a pair |

## Commands

Pool build (100 accounts takes about 17 minutes at one per 10 seconds):

```sh
$L SignUp --headless -u 1 -r 1 -t 20m
chmod 600 loadtest/accounts.jsonl
```

Smoke, 1 user, 1 minute (do `Visitor`, then `Member`, then `Moderation`):

```sh
$L Visitor --headless -u 1 -r 1 -t 1m
$L Member --headless -u 1 -r 1 -t 1m
$L Moderation --headless -u 1 -r 1 -t 1m
```

Baseline, about 10 users, 5 minutes:

```sh
$L Member --headless -u 10 -r 2 -t 5m --csv results/baseline --html results/baseline.html
```

Load (needs the rate-limit decision first), ramp then hold 10 minutes. Name the classes:
with no class named, Locust runs every class, including `SignUp`.

```sh
$L Visitor Member Moderation --headless -u 40 -r 2 -t 12m --csv results/load --html results/load.html
```

Classes are weighted 3 : 5 : 1. `Member` and `Moderation` users each need their own pool
account, so the user count that uses accounts must not exceed the pool size.

Stress: raise users in steps, one change between runs (for example 20, 40, 80, 160):

```sh
$L Visitor Member Moderation --headless -u 80 -r 2 -t 10m --csv results/stress-80
```

Spike: jump fast, then watch recovery:

```sh
$L Visitor Member Moderation --headless -u 100 -r 50 -t 5m --csv results/spike
```

Races (needs a free pool pair per user; paced by a request budget):

```sh
/opt/loadtest/venv/bin/locust -f loadtest/races.py RaceUser \
  --host https://staging.attayyibun.com --headless -u 1 -r 1 -t 2h --csv results/races
```

`POST /api/requests` is 10 an hour per address as shipped. `LOADTEST_REQUEST_BUDGET`
(default 8) makes the race user wait rather than collect 429s. If the limit is raised on
staging, raise the budget too. The `shared/<token>` race only runs when
`LOADTEST_TOKEN_FILE` points at a file with one token per line.

Web UI instead of `--headless`: leave those flags off, open `http://vm-loadtest:8089`
over Tailscale. Set `--host` on the command line; an empty host is refused.

## How to read a 429

429 means a rate limiter answered. It is shown as its own line in the stats, named like
`browse [429]`, is not counted as a failure, and is totalled in the summary. A 5xx, a wrong
status or a wrong body is a failure. The `invariant: ...` lines in `races.py` are failures
that mean a rule from the guide was broken.

## Code against guide: differences found on 2026-10-13

The code was re-read; where it disagrees with `GUIDE.md`, the code was followed.

1. **The one-time token is in API responses.** `GET /api/requests/incoming` and `/outgoing`
   spread the whole `info_requests` row (`apps/api/src/modules/requests/requests.service.ts:276`
   and `:308`), which includes `oneTimeToken` once a request is approved. The guide says it
   is in no response. It makes the `shared/<token>` race easy to set up, but the code here
   does not use it; supply tokens through `LOADTEST_TOKEN_FILE`.
2. **Both unique-index loser and approve/cancel races have no handling in the code.**
   `createRequest` inserts at `requests.service.ts:88` with no catch for the unique index, so the
   loser of a double post probably gets 500, not 409. `respondToRequest` updates by id only
   (`:170-180`, `:228`) and `cancelRequest` deletes by id (`:259`), so approve and cancel,
   or approve and deny, can both answer 200. The tests record this; they do not assume it.
3. **Shared link is not atomic.** `getSharedInfo` reads `tokenUsedAt` (`:333`) then writes it
   (`:337`); two readers at once may both succeed.
4. **Sending a request needs both profiles complete.** 400 otherwise (`requests.service.ts:53`,
   `:56`). Not in the guide.
5. **Reports email the admin.** `moderation.service.ts:159-161` sends to `ADMIN_EMAIL`
   (default `admin@attayyibun.com`). The guide lists only the request emails as
   harmless. Reports are therefore opt-in (`LOADTEST_REPORTS=1`). The report limit also exists
   twice: per address in `moderation.controller.ts:37` and per user in the service.
6. **`GET /api/blocks` returns the blocked user's name and email** (`moderation.service.ts:102-110`).
   Fine for pool accounts; the test does not read or print them.
7. **Per-route throttles replace one named bucket only.** `@Throttle({ short: ... })` on
   `POST /api/requests` (`requests.controller.ts:23`), `medium` on browse
   (`profiles.controller.ts:22`), `long` on reports and shared (`moderation.controller.ts:37`,
   `requests.controller.ts:80`). The other two global buckets still apply. Also, from how
   `@nestjs/throttler` v6 builds its keys (library not installed here, so not checked in
   this repo), counters are per route handler per address, not "all routes together". Check
   the `X-RateLimit-*` headers in the smoke run.
8. **Staging origin is not in `trustedOrigins`** (`apps/web/src/lib/auth.ts:154-161`). Only the
   `baseURL` origin (`:149-152`) is added automatically, so `BETTER_AUTH_URL` on staging matters.
9. **Skeleton changes, not code differences:** redirects off, 429 handled apart, no response
   text in failure messages, own account per user, `session/me` step added to `SignUp`.

## Only confirmable on a running staging site

- The sign-up response sets `__Secure-better-auth.session_token` and the `Origin` header
  passes better-auth's origin check.
- Which address the API counts for rate limits, and the real window of each limit.
- The verify call accepts a `loadtest-...` code (Firebase unset) and `updatePhoneNumber: true`
  keeps the session.
- Cloudflare Access accepts the service token on `/auth/*` and `/api/*`.
- Whether `GET /` and the other pages answer 200 without a redirect.
- Session cookie lifetime: an old pool file gives 401s; rebuild the pool.
- What really happens in each race (500 or 409, and the final state).

## After a session

Add an entry to `NOTES.md`, then ask the owner whether to reset the Neon `staging` branch.
Do not use `pnpm --filter api db:clean:tests`.
