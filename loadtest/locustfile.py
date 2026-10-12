"""Locust load test for At-Tayyibun. STAGING ONLY. See README.md and GUIDE.md.

    Visitor     journey A  not signed in
    SignUp      journey B  sign up, pass the phone gate, build a profile; builds the pool
    Member      journeys C and D (send then cancel), one pool account per user
    Moderation  journey E  blocks (and reports, if LOADTEST_REPORTS=1), pool targets only

Run one class by naming it:  locust -f loadtest/locustfile.py Member --host https://staging.attayyibun.com
The host must be exactly https://staging.attayyibun.com or the run is refused.
"""

import os
import random
from datetime import datetime, timezone

import gevent
from locust import between, constant, task

from common import (
    POOL,
    REPORT_REASONS,
    StagingUser,
    abort_run,
    append_to_pool,
    check,
    fake,
    fictional_phone,
    get_session_cookie,
    has_private_keys,
    json_body,
    new_person,
    set_session_cookie,
    wait_for_signup_slot,
)

REPORTS_ENABLED = os.environ.get("LOADTEST_REPORTS") == "1"


class Visitor(StagingUser):
    """Journey A. Not signed in. Pages are served by the web container."""

    wait_time = between(1, 3)
    weight = 3

    def on_start(self):
        self.public_ids = [a["publicId"] for a in POOL.accounts]

    def _page(self, path):
        with self.client.get(path, name=f"page {path}", catch_response=True) as r:
            if check(r, 200, f"GET {path}") and "<html" not in r.text[:2000].lower():
                r.failure(f"GET {path}: not an HTML page")

    @task(5)
    def home(self):
        self._page("/")

    @task(2)
    def about(self):
        self._page("/about")

    @task(2)
    def login(self):
        self._page("/login")

    @task(2)
    def signup_page(self):
        self._page("/signup")

    @task(2)
    def health(self):
        with self.client.get("/api/session/health", name="health", catch_response=True) as r:
            if check(r, 200, "health"):
                body = json_body(r)
                if not (isinstance(body, dict) and body.get("status") == "ok" and body.get("auth") == "better-auth"):
                    r.failure("health: unexpected body")

    @task(3)
    def preview_profile(self):
        if not self.public_ids:
            return
        pid = random.choice(self.public_ids)
        with self.client.get(f"/api/profiles/{pid}", name="visitor profile preview", catch_response=True) as r:
            if check(r, 200, "visitor profile preview"):
                body = json_body(r)
                if not isinstance(body, dict) or body.get("isFullView") is not False:
                    r.failure("visitor did not get the preview (isFullView should be false)")
                elif "biodata" in body or has_private_keys(body):
                    r.failure("visitor preview leaks biodata or a private field")


class SignUp(StagingUser):
    """Journey B. Also builds the pool. Run alone:

        locust -f loadtest/locustfile.py SignUp --host https://staging.attayyibun.com \\
            --headless -u 1 -r 1 -t 15m

    At most one account per 10 seconds is created however many users run
    (wait_for_signup_slot), which keeps phone verification under 8 a minute.
    """

    wait_time = constant(0)

    def on_start(self):
        POOL.accounts  # loads the file so phone numbers already used are not reused

    @task
    def sign_up(self):
        wait_for_signup_slot()
        self.client.cookies.clear()
        p = new_person()
        phone = fictional_phone()

        with self.client.post("/auth/sign-up/email", name="sign up", catch_response=True, json={
            "name": p["firstName"],
            "email": p["email"],
            "password": p["password"],
            "termsAcceptedAt": datetime.now(timezone.utc).isoformat(),
        }) as r:
            if not check(r, 200, "sign up"):
                return
            if not get_session_cookie(self.client):
                r.failure("sign up: no session cookie set")
                return

        with self.client.get("/api/session/me", name="session me", catch_response=True) as r:
            if not check(r, 200, "session me"):
                return

        with self.client.get("/api/profiles/me", name="phone gate", catch_response=True) as r:
            body = json_body(r)
            if r.status_code == 403 and isinstance(body, dict) and body.get("code") == "PHONE_VERIFICATION_REQUIRED":
                r.success()
            elif r.status_code == 429:
                check(r, 403, "phone gate")
                return
            else:
                r.failure(f"phone gate not enforced: got {r.status_code}")
                return

        with self.client.post("/auth/phone-number/verify", name="verify phone", catch_response=True, json={
            "phoneNumber": phone,
            "code": "loadtest-" + fake.uuid4().replace("-", ""),
            # Required. Without it this endpoint signs in as the number's owner.
            "updatePhoneNumber": True,
        }) as r:
            if not check(r, 200, "verify phone"):
                return

        with self.client.put("/api/profiles/me", name="save profile", catch_response=True, json={
            **{k: p[k] for k in ("firstName", "lastName", "dob", "gender", "ethnicity", "city", "state", "bio")},
            "biodata": {"education": "Bachelor's Degree", "profession": fake.job()[:100]},
        }) as r:
            if not check(r, 200, "save profile"):
                return
            body = json_body(r)
            profile = body.get("profile") if isinstance(body, dict) else None
            if not (isinstance(profile, dict) and profile.get("profileComplete") is True and body.get("publicId")):
                r.failure("save profile: profile not complete or no publicId")
                return
            public_id = body["publicId"]

        cookie = get_session_cookie(self.client)
        if not cookie:
            return
        append_to_pool({
            "email": p["email"],
            "gender": p["gender"],
            "publicId": public_id,
            "phone": phone,
            "cookie": cookie,
        })


class PoolUser(StagingUser):
    """Base for classes that act as one signed-in pool account of their own."""

    abstract = True

    def on_start(self):
        self.me = POOL.acquire()
        if self.me is None:
            abort_run(self, "no free pool account: run SignUp first, or lower the user count "
                            "(each Member/Moderation user needs its own account)")
        self.targets = POOL.others(self.me)  # pool only, never browse results
        if not self.targets:
            abort_run(self, "pool has no account of the other gender")
        set_session_cookie(self.client, self.me["cookie"])

    def on_stop(self):
        me = getattr(self, "me", None)
        if me is not None:
            POOL.release(me)


class Member(PoolUser):
    """Journeys C and D: browse, view, inbox, and send-then-cancel a match request."""

    wait_time = between(1, 4)  # a person pauses between actions
    weight = 5

    def on_start(self):
        super().on_start()
        # A leftover pending request (for example from a stopped run) would give 409.
        with self.client.get("/api/requests/active", name="active request", catch_response=True) as r:
            if check(r, 200, "active request"):
                body = json_body(r)
                if isinstance(body, dict) and body.get("id"):
                    self.client.delete(f"/api/requests/{body['id']}", name="cancel request")

    @task(6)
    def browse(self):
        # The browse page fires these three together.
        def mine():
            with self.client.get("/api/profiles/me", name="my profile", catch_response=True) as r:
                if check(r, 200, "my profile"):
                    body = json_body(r)
                    profile = body.get("profile") if isinstance(body, dict) else None
                    if not (isinstance(profile, dict) and profile.get("profileComplete") is True
                            and body.get("publicId") == self.me["publicId"]):
                        r.failure("my profile: not complete or wrong publicId")

        def active():
            with self.client.get("/api/requests/active", name="active request", catch_response=True) as r:
                check(r, 200, "active request")

        def browse_list():
            with self.client.get("/api/profiles", name="browse", catch_response=True,
                                 params={"page": random.randint(1, 3), "limit": 20}) as r:
                if check(r, 200, "browse"):
                    body = json_body(r)
                    rows = body.get("data") if isinstance(body, dict) else None
                    if not isinstance(rows, list) or not isinstance(body.get("meta"), dict):
                        r.failure("browse: no data/meta")
                    elif any(row.get("gender") == self.me["gender"] for row in rows):
                        r.failure("browse returned a same-gender profile")
                    elif has_private_keys(rows):
                        r.failure("browse leaks lastName, email or phone")

        gevent.joinall([gevent.spawn(f) for f in (mine, active, browse_list)])

    @task(3)
    def view_profile(self):
        target = random.choice(self.targets)
        with self.client.get(f"/api/profiles/{target['publicId']}", name="view profile", catch_response=True) as r:
            # 404 is allowed: a Moderation user may have this target blocked for a moment.
            if r.status_code == 404:
                r.request_meta["name"] += " [blocked 404]"
            if check(r, {200, 404}, "view profile") and r.status_code == 200:
                body = json_body(r)
                if not isinstance(body, dict) or body.get("isFullView") is not True:
                    r.failure("member did not get the full view")
                elif "biodata" not in body:
                    r.failure("full view has no biodata")
                elif has_private_keys(body):
                    r.failure("profile view leaks lastName, email or phone")

    @task(2)
    def inbox(self):
        for kind in ("incoming", "outgoing"):
            with self.client.get(f"/api/requests/{kind}", name=kind, catch_response=True) as r:
                if check(r, 200, kind) and not isinstance(json_body(r), list):
                    r.failure(f"{kind}: body is not a list")

    @task(1)
    def send_then_cancel(self):
        # 10 an hour per address as shipped. Cancelling frees this member's single pending slot.
        target = random.choice(self.targets)
        with self.client.post("/api/requests", name="send request", catch_response=True,
                              json={"targetPublicId": target["publicId"]}) as r:
            if r.status_code == 404:  # target blocked at this moment by a Moderation user
                r.request_meta["name"] += " [blocked 404]"
                check(r, {404}, "send request")
                return
            if not check(r, 201, "send request"):
                return
            body = json_body(r)
            request_id = body.get("id") if isinstance(body, dict) else None
            if not request_id:
                r.failure("send request: no id")
                return
        with self.client.delete(f"/api/requests/{request_id}", name="cancel request", catch_response=True) as r:
            if check(r, 200, "cancel request"):
                body = json_body(r)
                if not (isinstance(body, dict) and body.get("success") is True):
                    r.failure("cancel request: success is not true")


class Moderation(PoolUser):
    """Journey E: block, check the effect, unblock; optionally report. Low weight.

    Targets come from the pool only. Every block is lifted straight away so other
    users are not left blocked. Reports email the admin address when email is
    configured, so they run only with LOADTEST_REPORTS=1.
    """

    wait_time = between(3, 8)
    weight = 1  # low: Member is 5, Visitor 3. Name the class to run only one.

    @task(4)
    def block_cycle(self):
        target = random.choice(self.targets)
        pid = target["publicId"]
        with self.client.post("/api/blocks", name="block", catch_response=True, json={"targetPublicId": pid}) as r:
            if not check(r, 201, "block"):
                return
            body = json_body(r)
            if not (isinstance(body, dict) and body.get("success") is True):
                r.failure("block: success is not true")

        with self.client.get("/api/blocks", name="list blocks", catch_response=True) as r:
            if check(r, 200, "list blocks"):
                body = json_body(r)
                if not isinstance(body, list) or pid not in [b.get("targetPublicId") for b in body if isinstance(b, dict)]:
                    r.failure("list blocks: the block is not listed")

        # A blocked profile must answer 404, not 403.
        with self.client.get(f"/api/profiles/{pid}", name="view blocked profile", catch_response=True) as r:
            check(r, 404, "view blocked profile")

        with self.client.delete(f"/api/blocks/{pid}", name="unblock", catch_response=True) as r:
            check(r, 200, "unblock")

        with self.client.get(f"/api/profiles/{pid}", name="view unblocked profile", catch_response=True) as r:
            check(r, 200, "view unblocked profile")

    if REPORTS_ENABLED:

        @task(1)
        def report(self):
            target = random.choice(self.targets)
            with self.client.post("/api/reports", name="report", catch_response=True, json={
                "targetPublicId": target["publicId"],
                "reason": random.choice(REPORT_REASONS),
                "details": "load test " + fake.sentence(nb_words=6)[:200],
            }) as r:
                if check(r, 201, "report"):
                    body = json_body(r)
                    if not (isinstance(body, dict) and body.get("success") is True and body.get("id")):
                        r.failure("report: no success/id")

