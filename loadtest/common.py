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


def assert_staging(host):
    """Refuse anything that is not exactly https://staging.attayyibun.com."""
    if host not in (STAGING_URL, STAGING_URL + "/"):
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
    client_id = os.environ.get("CF_ACCESS_CLIENT_ID")
    client_secret = os.environ.get("CF_ACCESS_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise SystemExit("set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in the environment")
    return {
        "CF-Access-Client-Id": client_id,
        "CF-Access-Client-Secret": client_secret,
        "User-Agent": "locust-staging-loadtest",
        # The API refuses cookie-authenticated writes without one of these two.
        "Origin": STAGING_URL,
        "X-Requested-With": "locust",
        # Lets server logs be matched to one run.
        "X-Loadtest-Run": RUN_ID,
    }


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


@events.test_stop.add_listener
def _print_tally(environment, **_):
    counts = TALLY.snapshot()
    print(f"\n=== loadtest summary (run id {RUN_ID}) ===")
    if not counts:
        print("no 429s and no race outcomes recorded")
    for group in sorted({g for g, _ in counts}):
        print(f"[{group}]")
        for (g, key), n in sorted(counts.items()):
            if g == group:
                print(f"  {n:6d}  {key}")
    print("429 means the rate limiter answered; it is not counted as a failure.\n")


# --------------------------------------------------------------------------
# Base user: guard, headers, no redirects
# --------------------------------------------------------------------------


class StagingUser(HttpUser):
    abstract = True

    def __init__(self, environment):
        assert_staging(environment.host)  # before any client exists
        super().__init__(environment)
        self.client.headers.update(HEADERS)
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
    is not marked as a failure. On a pass the response is marked successful, and
    the caller may still call r.failure() after checking the body. Only the
    status (and an error code word, if present) is ever put in a message.
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
    }


# --------------------------------------------------------------------------
# Cookies
# --------------------------------------------------------------------------


def get_session_cookie(client):
    for c in client.cookies:
        if c.name == COOKIE:
            return c.value
    return None


def set_session_cookie(client, value):
    client.cookies.set(COOKIE, value, domain=STAGING_HOST, path="/", secure=True)


# --------------------------------------------------------------------------
# Account pool: loadtest/accounts.jsonl, one JSON object per line.
# Each line: email, gender, publicId, cookie (and phone). Holds live staging
# session cookies, so the file is gitignored and should be mode 600.
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

    def acquire(self, gender=None):
        """Hand out an account no other user holds, or None."""
        pool = self.accounts
        random.shuffle(pool)
        with self._lock:
            for a in pool:
                if a["email"] not in self._busy and (gender is None or a["gender"] == gender):
                    self._busy.add(a["email"])
                    return a
        return None

    def acquire_pair(self):
        """(requester, target) of opposite genders, both exclusive, or None."""
        first = self.acquire()
        if first is None:
            return None
        second = self.acquire("FEMALE" if first["gender"] == "MALE" else "MALE")
        if second is None:
            self.release(first)
            return None
        return first, second

    def release(self, account):
        with self._lock:
            self._busy.discard(account["email"])

    def others(self, me):
        """Accounts of the other gender. Targets always come from here, never from browse."""
        return [a for a in self.accounts if a["gender"] != me["gender"]]


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
# POST /api/requests (10 an hour per address as shipped)
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
    """Keeps POST /api/requests under the per-address hourly limit."""

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
