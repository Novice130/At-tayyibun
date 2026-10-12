# Locust and Faker testing guide: At-Tayyibun

Adapted from the shared guide in `infra/gmktec/loadtest/LOCUST_GUIDE.md` after
reading this project's code on 2026-10-13 (branch `chore/infra-hardening`).
Everything stated about routes, limits and behaviour below comes from the code
at the paths given. Where something still has to be confirmed on a running
staging site, it says so.

It is written for the Claude session working in this project and for the owner
reading along.

---

## Instructions for the assistant working in this project

You are helping the owner test how reliable attayyibun.com is, using Locust
(load testing, Python) and Faker (realistic fake names and profile text). The
owner is learning. Run things together with them, explain what each number
means in plain words, and keep notes.

### State on 2026-10-13

- Staging does not exist yet. `staging.attayyibun.com` does not resolve, VM
  `vm-loadtest` is not built, and `docs/STAGING_AND_LOADTEST.md` has not been
  written. The design is in
  `infra/docs/superpowers/specs/2026-10-13-gmktec-staging-design.md`.
- Until staging is up, the work that can be done is reading code, agreeing the
  journey list, and writing the locustfile. No runs.
- `loadtest/locustfile.py`, `loadtest/README.md` and `loadtest/NOTES.md` do not
  exist yet. This guide is the only file in `loadtest/`.

### Rules that do not bend

1. **Staging only.** Tests run against `https://staging.attayyibun.com` and
   nothing else. Never `attayyibun.com`, `www.` or `next.`. Keep the guard in
   the skeleton at the top of every locustfile.
2. **One site at a time.** The load-test VM and the staging sites share one
   physical machine. A Modest Ummah run at the same time spoils both.
3. **No payments here.** This site has no Stripe or checkout code. Membership
   tier and rank boost are set by an admin. There is nothing to pay for, so
   there is no payment test.
4. **No real people.** The staging database is a Neon branch copied from
   production, so it holds real members.
   - Every fake user's email ends in `@loadtest.invalid`.
   - Every fake phone number is in the fictional range
     `+1<area>55501<00 to 99>`, never a number that could belong to someone.
   - Requests, blocks and reports are aimed only at load-test accounts, taken
     from the pool file. Never pick a target from the browse results: those
     include real members.
   - Reading real profiles through browse is allowed. Do not print or save
     response bodies from them.
   - Do not sign in as, or modify, any account that was copied from production.
5. **No SMS.** Phone verification on staging works only because the Firebase
   admin variables are unset there (see "Phone gate" below). If
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
   are set on staging, stop: the journey cannot be automated and must not be
   forced.
6. **Start small.** One user first. Raise load only after the journey passes
   cleanly at the level below.
7. **Stop if something outside staging reacts**: a real email arrives, a
   production metric moves, Cloudflare starts blocking, a row appears in the
   production database. Report it and wait.
8. **No secrets in the repo.** The Cloudflare Access token comes from the
   environment. The account pool file holds live staging session cookies; it is
   gitignored and stays on the VM with mode 600.
9. **Never use `pnpm --filter api db:clean:tests` to clean up.** That script
   (`apps/api/src/db/cleanup-test-accounts.ts`) deletes every non-admin user in
   whatever database `DATABASE_URL` points at. Clean up by resetting the Neon
   `staging` branch.

### Where things live

| Thing | Place |
|---|---|
| Test code | `loadtest/locustfile.py` (more files under `loadtest/` if it grows) |
| Account pool | `loadtest/accounts.jsonl`, gitignored, built on the VM |
| How to run, and what each journey covers | `loadtest/README.md` |
| Results and lessons, one entry per session | `loadtest/NOTES.md` |
| Server and staging details | `docs/STAGING_AND_LOADTEST.md` (written when staging is built) |
| Where it runs | VM `vm-loadtest`, under `/opt/loadtest/attayyibun/`, using `/opt/loadtest/venv` |
| Containers to watch | `stg-attayyibun-web` (1.5 GB, 2 CPU), `stg-attayyibun-api` (1 GB, 1 CPU), `stg-attayyibun-redis` |

### How this site works, for testing purposes

**Two services behind one hostname.** The browser only ever talks to the web
app. Next.js serves the pages and the auth routes itself, and forwards
`/api/*` to the NestJS API (`apps/web/next.config.js`).

| Path | Served by | What it is |
|---|---|---|
| `/`, `/login`, `/signup`, `/about`, `/browse`, `/profiles/<publicId>`, ... | web | Pages |
| `/auth/*` | web | better-auth: sign up, sign in, phone verify (`apps/web/src/lib/auth.ts`, `basePath: "/auth"`) |
| `/api/*` | api | Profiles, requests, blocks, reports, photos, admin |

So sign-up and sign-in load lands on the web container (password hashing is
CPU work), and everything a signed-in member does lands on the API container.

**Session.** A signed cookie, `__Secure-better-auth.session_token` over HTTPS.
There is no bearer token. The API checks the cookie's signature and then looks
the session up in the database on every request
(`apps/api/src/common/guards/better-auth.guard.ts`).

**CSRF.** No CSRF token to fetch. Any POST, PUT, PATCH or DELETE to `/api/*`
that carries the session cookie must have either `Origin` equal to the site's
`WEB_URL`, or an `X-Requested-With` header
(`apps/api/src/common/middleware/origin-check.middleware.ts`). Send
`Origin: https://staging.attayyibun.com` on every request; that satisfies the
API and better-auth's own origin check. Confirm by hand in step 2.

**Phone gate.** A member who has not verified a phone number gets
`403 {"code": "PHONE_VERIFICATION_REQUIRED"}` on every API route except
`GET /api/session/me`, `POST /api/session/logout` and `DELETE /api/users/me`.
A fake user who only signs up can do nothing else.

In production the "code" sent to `POST /auth/phone-number/verify` is a Firebase
ID token obtained after an SMS. When the Firebase admin variables are unset,
`apps/web/src/lib/phone-verify.ts` accepts any code of 10 or more characters.
Staging is designed with those variables unset, and that is the only way a
Locust user gets through the gate. Two consequences:

- Always call verify while signed in, with `updatePhoneNumber: true`. Without a
  session the same endpoint signs you in as whoever owns that number, which on
  a copied database could be a real member.
- This is a fail-open path. If production ever starts without the Firebase
  variables, anyone can claim any number. It is a finding for the owner, not
  something to rely on outside staging.

**Email.** With `RESEND_API_KEY` unset, the emails sent on "request sent",
"approved" and "denied" fail inside a try/catch and the request still succeeds
(`apps/api/src/modules/requests/requests.service.ts`). Sign-up sends no email
(`sendOnSignUp: false`). Expect "Failed to send ... email" lines in the API
log; they are not faults.

**Redis** is used only by the admin email-campaign queue. Member journeys do
not touch it. The rate limiters are in memory, not in Redis.

**Not in this site:** cart, checkout, payments, member-to-member messaging (a
`messages` table exists but no route uses it), search beyond the browse
filters.

### Rate limits: settle this with the owner before any load run

Every limit below is counted **per IP address**, and every Locust user comes
from the same address. As the code stands, the limits will be reached long
before the servers are.

| Limit | Where | Value |
|---|---|---|
| All `/api/*` routes together | `apps/api/src/app.module.ts` | 20 per second, 100 per 10 seconds, 300 per minute |
| `GET /api/profiles` (browse) | `profiles.controller.ts` | 60 per minute |
| `POST /api/requests` | `requests.controller.ts` | 10 per hour |
| `POST /api/reports` | `moderation.controller.ts` | 10 per day |
| `GET /api/requests/shared/:token` | `requests.controller.ts` | 30 per minute |
| `POST /auth/sign-up/email`, `/auth/sign-in/email` | `apps/web/src/lib/auth.ts` | 10 per minute each |
| `POST /auth/phone-number/verify` | same | 8 per minute |
| Any `/auth/*` route | same | 100 per 10 seconds |
| `/api/admin/*` | `admin.controller.ts` | not limited |

Pages served by Next.js are not limited by the app.

What this means: about 5 requests a second across the whole API, 10 match
requests an hour, and 8 new accounts a minute, no matter how many users Locust
simulates. A 429 is the limiter doing its job, not the site failing.

Do not work round the limits (no forged `X-Forwarded-For`, no editing them
quietly). Put the choice to the owner:

- **Keep the limits.** Tests then show correctness, the race cases and that the
  limiter behaves, but not capacity.
- **Add a staging-only switch** that raises them, in `app.module.ts` and in
  `auth.ts`. It is a small change to this repo, it needs its own review, and it
  must be impossible to turn on in production.

Two things to check in the first smoke run and write in the notes:

- Which address the API counts. It sits behind Cloudflare, the tunnel, Traefik
  and the Next.js rewrite, with `trust proxy` set to 1. If it sees the proxy's
  address instead of the visitor's, every real member shares one bucket. The
  `X-RateLimit-Remaining-*` response headers show the count falling.
- `POST /api/requests` is 10 an hour per address, not per member. Members
  behind one home or mobile network share it.

### Method

Work through these in order. Do not skip ahead.

1. **Read the code.** Done for the journeys below on 2026-10-13. Re-read any
   file that has changed since, and show the owner the journey list to agree
   which to test first.
2. **Walk it by hand once.** Do journey B in a browser on staging with the
   network tab open, or with `curl`. Confirm: sign-up returns the session
   cookie, the 403 phone gate appears, verify with a fake code succeeds, the
   profile save returns `profileComplete: true`.
3. **Write the journey as one Locust user class.** Check every response
   (status and a piece of the body), not just that it answered.
4. **Build the account pool** with the sign-up journey, slowly (under 8 a
   minute). Aim for 50 brothers and 50 sisters to start.
5. **Smoke: 1 user, 1 minute.** Zero failures before going on. Look in the
   staging database to confirm the rows exist.
6. **Baseline: about 10 users, 5 minutes.** Record median, 95th percentile,
   requests per second, failure rate, and 429s as a separate count.
7. **Load: ramp to the expected busy-day level, hold 10 minutes.** Needs the
   rate-limit decision first.
8. **Stress: keep raising users in steps until something gives.** Note the
   level where the 95th percentile passes 1 second and where errors start.
   Find out what gave: API CPU (it has one), web CPU, memory limit, Neon
   connections, a lock.
9. **Spike: jump from few users to many in seconds.** Does it recover?
10. **Soak (optional): moderate load for 30 to 60 minutes.** Watch memory.
11. **The match-request scenarios** below.
12. **Write up, reset.** Add the entry to `NOTES.md`, then ask the owner
    whether to reset the Neon `staging` branch.

Change one thing between runs. While a run is going, watch `docker stats` for
the three staging containers on the Dokploy VM. The Neon branch may be
suspended when idle; open the site once before measuring so the first seconds
are not skewed.

### Journeys

**A. Visitor, not signed in** (web container, no rate limit from the app)

- `GET /`, `/about`, `/login`, `/signup`
- `GET /api/session/health` returns `{"status":"ok","auth":"better-auth"}`
- `GET /api/profiles/<publicId>` of a load-test account returns the preview
  with `isFullView: false` and no `biodata`

**B. Sign up, pass the phone gate, build a profile** (also builds the pool)

1. `POST /auth/sign-up/email` with `name`, `email`, `password`,
   `termsAcceptedAt`. Expect 200 and the session cookie.
2. `GET /api/session/me`. Expect 200.
3. `GET /api/profiles/me`. Expect 403 with `PHONE_VERIFICATION_REQUIRED`.
   This proves the gate is on.
4. `POST /auth/phone-number/verify` with `phoneNumber` (E.164), `code` (any 10
   or more characters), `updatePhoneNumber: true`. Expect 200.
5. `PUT /api/profiles/me` with `firstName`, `lastName`, `dob` (18 or older, or
   it is refused), `gender`, `ethnicity`, `city`, `state`, `bio`, `biodata`.
   Expect `profile.profileComplete` true and a `publicId`. Unknown top-level
   fields are rejected with 400.

**C. Member browsing** (API container)

- The browse page fires three calls together: `GET /api/profiles/me`,
  `GET /api/profiles?page=1&limit=20`, `GET /api/requests/active`.
- `GET /api/profiles` takes `ethnicity`, `minAge`, `maxAge`,
  `sortBy` (`age`, `createdAt`, `rankBoost`), `order`, `page`, `limit` (50 at
  most). A member only ever sees the other gender; check that every row in the
  response has it.
- `GET /api/profiles/<publicId>` returns `isFullView: true` with `biodata`.
- `GET /api/requests/incoming` and `GET /api/requests/outgoing`.

**D. Match request** (the core action; the code calls it an info request)

1. Requester: `POST /api/requests` with `targetPublicId`. Expect 201 and an
   `id`. A member may hold one pending request at a time; a second gives 409.
2. Target: `GET /api/requests/incoming`, then
   `PUT /api/requests/<id>/respond` with `approved` and, when approving,
   `shareItems` from `photo`, `phone`, `email`.
3. Or requester: `DELETE /api/requests/<id>` to cancel, which frees the slot.
4. `GET /api/requests/shared/<token>` is the one-time link from the approval.
   The token is in no API response, only in the database, so read it from
   `info_requests.one_time_token` in the staging branch if this is tested.

**E. Blocks and reports**

- `POST /api/blocks` with `targetPublicId`, `GET /api/blocks`,
  `DELETE /api/blocks/<publicId>`.
- `POST /api/reports` with `targetPublicId`, `reason` (`FAKE_PROFILE`,
  `INAPPROPRIATE_CONTENT`, `HARASSMENT`, `SPAM_OR_SCAM`, `UNDERAGE`, `OTHER`),
  optional `details`.
- After a block in either direction: the blocked profile returns 404, is
  missing from browse, and a request to it returns 404.

**Left out, and why**

- Photo upload (`POST /api/photos`): writes to Google Cloud Storage. Ask the
  owner what bucket staging uses before touching it.
- Google and Apple sign-in: not configured on staging.
- Admin panel: needs an emailed 2FA code, and staging sends no email.
- The Flutter app: it calls the same API, so the API journeys cover it.

### The match-request scenarios

**Many members sending requests at once.** Every pool account sends one request
to a different load-test account of the other gender. Afterwards, in the
staging branch: the number of `PENDING` rows equals the number of 201
responses, and no requester has two.

**Many requests aimed at the same few profiles.** Point most of the pool at
three or four targets, then time `GET /api/requests/incoming` for those
targets. It runs one extra query per row, so expect it to slow as the list
grows; record at what length it passes 800 ms.

**Both sides acting on the same request at the same moment.** Run each of these
as a pair fired together, many times:

- The same member posts two requests at once. The code reads, then inserts; a
  database index allows one pending row per requester. Expect exactly one row.
  Record what the loser receives: 409 is right, 500 is a finding.
- The target approves while the requester cancels. Expect one outcome, and no
  approved row for a request the requester saw cancelled.
- The target approves and denies at once (two tabs). The code reads, then
  writes, with no lock. Record the final status and whether both answered 200.
- Two readers open the same `shared/<token>` link at once. It is meant to work
  once. Record whether both got the contact details.

**Privacy checks, on every run.** No response to another member contains a last
name, email or phone. A visitor's profile view has no `biodata`. A blocked
member gets 404, not 403. `createRequest` has no gender check of its own;
record whether a request to a same-gender profile is accepted.

### Reading the numbers (explain these to the owner as they appear)

- **Users**: simulated people, each repeating the journey with pauses.
- **RPS**: requests per second the site is handling.
- **Median (p50)**: what a typical request took.
- **p95 / p99**: what the slowest 5% / 1% took. This is what unlucky users
  feel; it matters more than the average.
- **Failures**: requests that errored or failed a check. Above 1% under normal
  load is a problem to explain. Count 429s apart from other failures: here they
  usually mean the per-address limit, not a broken site.
- **The knee**: the user count where response time stops rising gently and
  shoots up. Capacity is a bit below that.

Starting thresholds, to be tuned: p95 under 800 ms and failures under 1% at
expected load; no 5xx at all in smoke and baseline.

These numbers compare one build with another. They are not production
capacity: production is a 2 vCPU Hetzner server, staging is a home machine
shared with the load generator.

### Skeleton

A starting point, not tested against staging yet. Field names and limits are
from the code; confirm each response in step 2 before trusting the checks.

```python
import json
import os
import random
import uuid
from pathlib import Path
from urllib.parse import urlparse

from faker import Faker
from locust import HttpUser, between, constant_pacing, events, task

fake = Faker("en_US")

STAGING_HOST = "staging.attayyibun.com"
COOKIE = "__Secure-better-auth.session_token"
POOL_FILE = Path(__file__).with_name("accounts.jsonl")
ETHNICITIES = ["South Asian", "Arab", "African", "Turkish", "Persian"]

HEADERS = {
    "CF-Access-Client-Id": os.environ["CF_ACCESS_CLIENT_ID"],
    "CF-Access-Client-Secret": os.environ["CF_ACCESS_CLIENT_SECRET"],
    "User-Agent": "locust-staging-loadtest",
    # The API refuses cookie-authenticated writes without one of these two.
    "Origin": f"https://{STAGING_HOST}",
    "X-Requested-With": "locust",
}


@events.init.add_listener
def staging_only(environment, **_):
    """Refuse to start unless the target is exactly the staging site."""
    url = urlparse(environment.host or "")
    if url.scheme != "https" or url.hostname != STAGING_HOST:
        raise SystemExit(f"guard: refusing to run against {environment.host!r}")


def load_pool():
    if not POOL_FILE.exists():
        return []
    return [json.loads(line) for line in POOL_FILE.read_text().splitlines() if line]


POOL = load_pool()


def fictional_phone():
    # 555-0100 to 555-0199 is reserved for fiction in every US area code.
    return f"+1{random.randint(201, 989)}55501{random.randint(0, 99):02d}"


def new_person():
    gender = random.choice(["MALE", "FEMALE"])
    first = fake.first_name_male() if gender == "MALE" else fake.first_name_female()
    return {
        "firstName": first,
        "lastName": fake.last_name(),
        "email": f"lt-{uuid.uuid4().hex[:12]}@loadtest.invalid",
        "password": fake.password(length=14),
        "dob": fake.date_of_birth(minimum_age=21, maximum_age=45).isoformat(),
        "gender": gender,
        "ethnicity": random.choice(ETHNICITIES),
        "city": fake.city(),
        "state": fake.state_abbr(),
        "bio": fake.paragraph(nb_sentences=4),
    }


def expect(r, status, what):
    """Mark the response failed unless it has the expected status."""
    if r.status_code == 429:
        r.failure(f"{what}: 429 rate limited")
    elif r.status_code != status:
        r.failure(f"{what}: {r.status_code} {r.text[:120]}")
    else:
        return True
    return False


class SignUp(HttpUser):
    """Journey B. Also builds the pool. Run alone with one user:

    locust -f loadtest/locustfile.py SignUp --headless -u 1 -r 1 -t 15m
    """

    # One account every 10 seconds stays under 8 phone verifications a minute.
    wait_time = constant_pacing(10)

    def on_start(self):
        self.client.headers.update(HEADERS)

    @task
    def sign_up(self):
        self.client.cookies.clear()
        p = new_person()

        with self.client.post("/auth/sign-up/email", name="sign up", catch_response=True, json={
            "name": p["firstName"],
            "email": p["email"],
            "password": p["password"],
            "termsAcceptedAt": fake.date_time_this_month().isoformat() + "Z",
        }) as r:
            if not expect(r, 200, "sign up"):
                return

        with self.client.get("/api/profiles/me", name="phone gate", catch_response=True) as r:
            if r.status_code == 403 and "PHONE_VERIFICATION_REQUIRED" in r.text:
                r.success()
            else:
                r.failure(f"gate not enforced: {r.status_code}")
                return

        with self.client.post("/auth/phone-number/verify", name="verify phone", catch_response=True, json={
            "phoneNumber": fictional_phone(),
            "code": "loadtest-" + uuid.uuid4().hex,
            # Required. Without it this endpoint signs in as the number's owner.
            "updatePhoneNumber": True,
        }) as r:
            if not expect(r, 200, "verify phone"):
                return

        with self.client.put("/api/profiles/me", name="save profile", catch_response=True, json={
            key: p[key]
            for key in ("firstName", "lastName", "dob", "gender", "ethnicity", "city", "state", "bio")
        } | {"biodata": {"education": "Bachelor's Degree", "profession": fake.job()}}) as r:
            if not expect(r, 200, "save profile"):
                return
            body = r.json()
            if not body["profile"]["profileComplete"]:
                r.failure("profile not complete")
                return

        with POOL_FILE.open("a") as f:
            f.write(json.dumps({
                "email": p["email"],
                "gender": p["gender"],
                "publicId": body["publicId"],
                "cookie": self.client.cookies.get(COOKIE),
            }) + "\n")


class Member(HttpUser):
    """Journeys C and D, using an account from the pool."""

    wait_time = between(1, 4)  # a person pauses between actions

    def on_start(self):
        if not POOL:
            raise SystemExit("no accounts: run the SignUp class first")
        self.me = random.choice(POOL)
        # Targets come from the pool only, never from browse results.
        self.targets = [a for a in POOL if a["gender"] != self.me["gender"]]
        self.client.headers.update(HEADERS)
        self.client.cookies.set(COOKIE, self.me["cookie"], domain=STAGING_HOST, secure=True)

    @task(6)
    def browse(self):
        self.client.get("/api/profiles/me", name="my profile")
        self.client.get("/api/requests/active", name="active request")
        with self.client.get("/api/profiles", name="browse", catch_response=True,
                             params={"page": random.randint(1, 3), "limit": 20}) as r:
            if expect(r, 200, "browse"):
                rows = r.json()["data"]
                if any(row["gender"] == self.me["gender"] for row in rows):
                    r.failure("browse returned a same-gender profile")

    @task(3)
    def view_profile(self):
        target = random.choice(self.targets)
        with self.client.get(f"/api/profiles/{target['publicId']}",
                             name="view profile", catch_response=True) as r:
            if expect(r, 200, "view profile") and not r.json().get("isFullView"):
                r.failure("member did not get the full view")

    @task(2)
    def inbox(self):
        self.client.get("/api/requests/incoming", name="incoming")
        self.client.get("/api/requests/outgoing", name="outgoing")

    @task(1)
    def send_then_cancel(self):
        # Limited to 10 an hour for the whole run until the owner decides
        # otherwise. Cancelling frees this member's single pending slot.
        target = random.choice(self.targets)
        with self.client.post("/api/requests", name="send request", catch_response=True,
                              json={"targetPublicId": target["publicId"]}) as r:
            if not expect(r, 201, "send request"):
                return
            request_id = r.json()["id"]
        with self.client.delete(f"/api/requests/{request_id}",
                                name="cancel request", catch_response=True) as r:
            expect(r, 200, "cancel request")
```

Two Locust users can pick the same pool account. That is fine for browsing and
gives a 409 on `send request`; for the request scenarios, hand each user its
own account instead of `random.choice`.

Run with the web UI, then open `http://vm-loadtest:8089` over Tailscale:

```sh
cd /opt/loadtest/attayyibun
set -a; . /opt/loadtest/.env; set +a
/opt/loadtest/venv/bin/locust -f loadtest/locustfile.py Member \
  --host https://staging.attayyibun.com
```

Run without the UI, saving results:

```sh
/opt/loadtest/venv/bin/locust -f loadtest/locustfile.py Member \
  --host https://staging.attayyibun.com \
  --headless -u 10 -r 2 -t 5m --csv results/baseline --html results/baseline.html
```

`-u` is users, `-r` is how many users start per second, `-t` is duration.
Naming a class (`SignUp` or `Member`) runs only that one.

### Notes format (`loadtest/NOTES.md`)

One entry per session, newest first:

```
## 2026-10-20: browse baseline and request races
Build: <commit sha>    Target: https://staging.attayyibun.com
Limits: as shipped | raised on staging (how)
Journey: browse → view profile → send request → cancel
| Run | Users | Ramp | Time | RPS | p50 | p95 | Fail % | 429s |
Found: what broke or slowed, at what load, and the cause if known.
Changed: fixes made as a result (commit).
Learned: what the owner should remember next time, in plain words.
Next: what to test next.
```

Report results as they are. If a run failed or was cut short, write that.
