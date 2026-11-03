"""Shared code for locustfile.py and races.py.

Holds the staging-only guard, the headers sent on every request, the fake-person
generator, the account pool, and the response checker. See README.md.

Nothing in here prints or saves response bodies.
"""

import json
import os
import random
import re
import sys
import threading
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import gevent
from faker import Faker
from locust import HttpUser, events
from locust.exception import StopUser

fake = Faker("en_US")

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

STAGING_URL = "https://staging.attayyibun.com"
STAGING_HOST = "staging.attayyibun.com"
COOKIE = "__Secure-better-auth.session_token"
POOL_FILE = Path(os.environ.get("LOADTEST_POOL_FILE") or Path(__file__).with_name("accounts.jsonl"))
EMAIL_DOMAIN = "@loadtest.invalid"
ETHNICITIES = ["South Asian", "Arab", "African", "Turkish", "Persian"]
REPORT_REASONS = ["FAKE_PROFILE", "INAPPROPRIATE_CONTENT", "HARASSMENT", "SPAM_OR_SCAM", "UNDERAGE", "OTHER"]
MARITAL_STATUSES = ["NEVER_MARRIED", "DIVORCED", "WIDOWED"]  # apps/api marital-match.ts
BYPASS_HEADER = "X-Loadtest-Bypass"

# Keys that must never appear in anything shown to another member.
PRIVATE_KEYS = {"lastName", "email", "phone"}


def _run_id():
    value = os.environ.get("LOADTEST_RUN_ID") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", value):
        raise SystemExit("guard: LOADTEST_RUN_ID may only contain letters, digits, '.', '_' and '-' (max 64)")
    return value


RUN_ID = _run_id()


# --------------------------------------------------------------------------
# Staging-only guard
# --------------------------------------------------------------------------


# A server on this machine, for a smoke run only. Must be asked for explicitly.
LOCAL = os.environ.get("LOADTEST_LOCAL") == "1"
_LOCAL_HOST = re.compile(r"http://(localhost|127\.0\.0\.1):\d{2,5}/?")


def assert_staging(host):
    """Refuse anything but exactly https://staging.attayyibun.com, or localhost with LOADTEST_LOCAL=1."""
    if host in (STAGING_URL, STAGING_URL + "/"):
        return
    if LOCAL and isinstance(host, str) and _LOCAL_HOST.fullmatch(host):
        return
    raise SystemExit(f"guard: refusing to run against {host!r}; only {STAGING_URL} is allowed")


def _check_argv_host():
    """Earliest possible check: look at --host on the command line at import time."""
    argv = sys.argv[1:]
    for i, arg in enumerate(argv):
        value = None
        if arg in ("--host", "-H") and i + 1 < len(argv):
            value = argv[i + 1]
        elif arg.startswith("--host="):
            value = arg.split("=", 1)[1]
        if value is not None:
            assert_staging(value)


_check_argv_host()


@events.init.add_listener
def _guard_on_init(environment, **_):
    # An empty host (no --host given) is refused too.
    assert_staging(environment.host)


@events.test_start.add_listener
def _guard_on_start(environment, **_):
    # The web UI lets the host be edited after launch, so check again.
    assert_staging(environment.host)


# --------------------------------------------------------------------------
# Headers
# --------------------------------------------------------------------------


def request_headers():
    headers = {
        "User-Agent": "locust-staging-loadtest",
        # The API refuses cookie-authenticated writes without one of these two.
        "X-Requested-With": "locust",
        # Lets server logs be matched to one run.
        "X-Loadtest-Run": RUN_ID,
    }
    if not LOCAL:
        client_id = os.environ.get("CF_ACCESS_CLIENT_ID")
        client_secret = os.environ.get("CF_ACCESS_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise SystemExit("set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in the environment")
        headers["CF-Access-Client-Id"] = client_id
        headers["CF-Access-Client-Secret"] = client_secret
        headers["Origin"] = STAGING_URL
    # Skips the rate limits, on staging only; the server ignores it elsewhere. Never printed.
    bypass = os.environ.get("LOADTEST_BYPASS_SECRET")
    if bypass:
        headers[BYPASS_HEADER] = bypass
    return headers


HEADERS = request_headers()


# --------------------------------------------------------------------------
# Counters printed when the test stops (429s, race outcomes)
# --------------------------------------------------------------------------


class Tally:
    def __init__(self):
        self._lock = threading.Lock()
        self._counts = Counter()

    def add(self, group, key, n=1):
        with self._lock:
            self._counts[(group, key)] += n

    def snapshot(self):
        with self._lock:
            return dict(self._counts)


TALLY = Tally()


def status_class(status):
    """The bucket a status is counted in at the end of a run, or None if uninteresting."""
    if status == 401:
        return "401 unauthorized"
    if status == 429:
        return "429 rate limited"
    if 500 <= status <= 599:
        return "5xx server error"
    return None


def count_response(response, *_args, **_kwargs):
    """requests response hook: counts every response, including ones no check() saw."""
    bucket = status_class(response.status_code)
    if bucket:
        TALLY.add("all responses by status", bucket)
    TALLY.add("all responses by status", "total")


def thresholds_broken(stats, env=os.environ):
    """Which of LOADTEST_MAX_P95_MS, _P99_MS and _FAIL_PCT this run exceeded."""
    broken = []
    limits = (
        ("LOADTEST_MAX_P95_MS", stats.get_response_time_percentile(0.95)),
        ("LOADTEST_MAX_P99_MS", stats.get_response_time_percentile(0.99)),
        ("LOADTEST_MAX_FAIL_PCT", stats.fail_ratio * 100),
    )
    for name, value in limits:
        limit = env.get(name)
        if limit and value is not None and float(value) > float(limit):
            broken.append(f"{name}={limit}: measured {float(value):.1f}")
    return broken


@events.quitting.add_listener
def _exit_code_from_thresholds(environment, **_):
    broken = thresholds_broken(environment.stats.total)
    for line in broken:
        print(f"THRESHOLD BROKEN {line}", file=sys.stderr)
    if broken:
        environment.process_exit_code = 1


@events.test_stop.add_listener
def _print_tally(environment, **_):
    counts = TALLY.snapshot()
    print(f"\n=== loadtest summary (run id {RUN_ID}) ===")
    if not counts:
        print("no responses counted")
    for group in sorted({g for g, _ in counts}):
        print(f"[{group}]")
        for (g, key), n in sorted(counts.items()):
            if g == group:
                print(f"  {n:6d}  {key}")
    print("429 means the rate limiter answered; it is not counted as a failure. 401 and 5xx are.\n")


# --------------------------------------------------------------------------
# Base user: guard, headers, no redirects
# --------------------------------------------------------------------------


class StagingUser(HttpUser):
    abstract = True

    def __init__(self, environment):
        assert_staging(environment.host)  # before any client exists
        super().__init__(environment)
        self.client.headers.update(HEADERS)
        self.client.hooks["response"].append(count_response)
        # A redirect could lead to another host (for example production). Do not follow any.
        self.client.max_redirects = 0


def abort_run(user, message):
    print(f"loadtest: {message}", file=sys.stderr)
    if user.environment.runner is not None:
        user.environment.runner.quit()
    raise StopUser()


# --------------------------------------------------------------------------
# Response checking
# --------------------------------------------------------------------------


def json_body(r):
    """Parsed JSON body, or None. Never raises, never logs."""
    try:
        return r.json()
    except Exception:
        return None


def check(r, ok, what):
    """Mark a catch_response response and say whether it passed the status check.

    `ok` is a status code or a collection of them. A 429 is reported under the
    request name with " [429]" added and counted in the end-of-test summary; it
    is not marked as a failure. A 401 and a 5xx are failures, reported the same
    way so they stand apart in the stats. On a pass the response is marked
    successful, and the caller may still call r.failure() after checking the
    body. Only the status (and an error code word, if present) is ever put in a
    message.
    """
    allowed = {ok} if isinstance(ok, int) else set(ok)
    status = r.status_code
    if status == 429:
        name = r.request_meta["name"]
        TALLY.add("429 rate limited", name)
        r.request_meta["name"] = name + " [429]"
        r.success()
        gevent.sleep(1)  # back off a little; this is not a way round the limit
        return False
    if status == 0:
        r.failure(f"{what}: no response (connection error or redirect)")
        return False
    if status in allowed:
        r.success()
        return True
    code = ""
    body = json_body(r)
    if isinstance(body, dict) and isinstance(body.get("code"), str):
        code = " " + body["code"][:40]
    bucket = status_class(status)
    if bucket:
        name = r.request_meta["name"]
        TALLY.add(bucket, name)
        r.request_meta["name"] = f"{name} [{status if status == 401 else '5xx'}]"
    hint = " (session expired? rebuild the pool)" if status == 401 else ""
    r.failure(f"{what}: got {status}{code}, expected {sorted(allowed)}{hint}")
    return False


def has_private_keys(value):
    """True if any dict inside `value` has a key from PRIVATE_KEYS."""
    if isinstance(value, dict):
        return any(k in PRIVATE_KEYS or has_private_keys(v) for k, v in value.items())
    if isinstance(value, list):
        return any(has_private_keys(v) for v in value)
    return False


# --------------------------------------------------------------------------
# Fake people
# --------------------------------------------------------------------------

_phone_lock = threading.Lock()
_used_phones = set()


def fictional_phone():
    """+1<area>55501NN. 555-0100 to 555-0199 is reserved for fiction in every US area code."""
    with _phone_lock:
        for _ in range(1000):
            area = random.randint(201, 989)
            if area % 100 == 11:  # N11 is not an area code
                continue
            number = f"+1{area}55501{random.randint(0, 99):02d}"
            if number not in _used_phones:
                _used_phones.add(number)
                return number
    raise SystemExit("could not find an unused fictional phone number")


def _name(maker):
    for _ in range(20):
        value = maker()
        if 2 <= len(value) <= 50 and value.isalpha():
            return value
    return "Test"


def new_person():
    gender = random.choice(["MALE", "FEMALE"])
    first = _name(fake.first_name_male if gender == "MALE" else fake.first_name_female)
    # Same spread as apps/api/src/db/seed-loadtest.lib.ts. maritalStatus and
    # hasChildren are required: without them browse answers 403 PROFILE_INCOMPLETE.
    marital = random.choices(MARITAL_STATUSES, weights=[70, 22, 8])[0]
    has_children = marital != "NEVER_MARRIED" and random.random() < 0.5
    return {
        "firstName": first,
        "lastName": _name(fake.last_name),
        "email": f"lt-{uuid.uuid4().hex[:12]}{EMAIL_DOMAIN}",
        "password": fake.password(length=14),
        "dob": fake.date_of_birth(minimum_age=21, maximum_age=45).isoformat(),
        "gender": gender,
        "ethnicity": random.choice(ETHNICITIES),
        "city": fake.city()[:100],
        "state": fake.state_abbr(),
        "bio": fake.paragraph(nb_sentences=4)[:2000],
        "maritalStatus": marital,
        "hasChildren": has_children,
        "childrenCount": random.randint(1, 4) if has_children else None,
        "openToDivorced": random.random() < 0.5,
        "openToWidowed": random.random() < 0.45,
        "openToChildren": random.random() < 0.35,
    }


# --------------------------------------------------------------------------
# Two-way matching: apps/api/src/modules/profiles/marital-match.ts, written again.
# A pair that does not match gets 404 on profile views and on requests.
# --------------------------------------------------------------------------


def _acceptable(open_to, person):
    status = person.get("maritalStatus") or "NEVER_MARRIED"
    status_ok = (
        status == "NEVER_MARRIED"
        or (status == "DIVORCED" and bool(open_to.get("openToDivorced")))
        or (status == "WIDOWED" and bool(open_to.get("openToWidowed")))
    )
    children_ok = not person.get("hasChildren") or bool(open_to.get("openToChildren"))
    return status_ok and children_ok


def is_mutual_match(a, b):
    return _acceptable(a, b) and _acceptable(b, a)


# --------------------------------------------------------------------------
# Cookies
# --------------------------------------------------------------------------


def get_session_cookie(client):
    for c in client.cookies:
        if c.name == COOKIE:
            return c.value
    return None


def set_session_cookie(client, value):
    if LOCAL:
        client.cookies.set(COOKIE, value)
    else:
        client.cookies.set(COOKIE, value, domain=STAGING_HOST, path="/", secure=True)


# --------------------------------------------------------------------------
# Account pool: loadtest/accounts.jsonl, one JSON object per line.
# Each line: email, gender, publicId, cookie, phone and the marital answers.
# Written by SignUp and by the seed script. Holds live staging session cookies,
# so the file is gitignored and should be mode 600.
# --------------------------------------------------------------------------


class Pool:
    def __init__(self, path):
        self.path = path
        self._lock = threading.Lock()
        self._accounts = None
        self._busy = set()

    def _load(self):
        accounts = []
        if self.path.exists():
            for n, line in enumerate(self.path.read_text().splitlines(), 1):
                if not line.strip():
                    continue
                a = json.loads(line)
                if not str(a.get("email", "")).endswith(EMAIL_DOMAIN):
                    raise SystemExit(f"guard: {self.path}:{n} is not a {EMAIL_DOMAIN} account")
                accounts.append(a)
                if a.get("phone"):
                    _used_phones.add(a["phone"])
        return accounts

    @property
    def accounts(self):
        with self._lock:
            if self._accounts is None:
                self._accounts = self._load()
            return list(self._accounts)

    def acquire(self, accept=None):
        """Hand out an account no other user holds, passing `accept` if given, or None."""
        # `accept` runs outside the lock: it may call others(), which takes it too.
        pool = [a for a in self.accounts if accept is None or accept(a)]
        random.shuffle(pool)
        with self._lock:
            for a in pool:
                if a["email"] not in self._busy:
                    self._busy.add(a["email"])
                    return a
        return None

    def acquire_with_targets(self):
        """An account that has at least one possible target."""
        return self.acquire(lambda a: bool(self.others(a)))

    def acquire_pair(self):
        """(requester, target) who match each other, both exclusive, or None."""
        first = self.acquire_with_targets()
        if first is None:
            return None
        second = self.acquire(lambda a: a["gender"] != first["gender"] and is_mutual_match(first, a))
        if second is None:
            self.release(first)
            return None
        return first, second

    def release(self, account):
        with self._lock:
            self._busy.discard(account["email"])

    def others(self, me):
        """Accounts of the other gender who match. Targets always come from here, never from browse."""
        return [a for a in self.accounts if a["gender"] != me["gender"] and is_mutual_match(me, a)]


POOL = Pool(POOL_FILE)


def append_to_pool(entry):
    line = json.dumps(entry) + "\n"
    fd = os.open(POOL_FILE, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    try:
        os.write(fd, line.encode())
    finally:
        os.close(fd)


# --------------------------------------------------------------------------
# Pacing for sign-up (<= 1 account per 10 s across all users) and for
# POST /api/requests (10 an hour per user as shipped; none with the bypass)
# --------------------------------------------------------------------------

SIGNUP_INTERVAL = 10.0
_signup_lock = threading.Lock()
_last_signup = [0.0]


def wait_for_signup_slot():
    with _signup_lock:
        wait = _last_signup[0] + SIGNUP_INTERVAL - time.monotonic()
        if wait > 0:
            gevent.sleep(wait)
        _last_signup[0] = time.monotonic()


class RequestBudget:
    """Keeps POST /api/requests under the hourly limit."""

    def __init__(self, limit, window=3600.0):
        self.limit, self.window = limit, window
        self._lock = threading.Lock()
        self._stamps = []

    def take(self, n=1):
        with self._lock:
            now = time.monotonic()
            self._stamps = [t for t in self._stamps if now - t < self.window]
            if len(self._stamps) + n > self.limit:
                return False
            self._stamps.extend([now] * n)
            return True

    def wait_take(self, n=1, poll=15.0):
        while not self.take(n):
            gevent.sleep(poll)


REQUEST_BUDGET = RequestBudget(int(os.environ.get("LOADTEST_REQUEST_BUDGET", "8")))
