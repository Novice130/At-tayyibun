"""Race cases for the match-request flow. STAGING ONLY. See README.md and GUIDE.md.

Each round takes two pool accounts (a requester A and a target B of the other
gender, both exclusive to this user) and fires a pair of calls at the same moment:

    double-post       A posts two requests at once        expect one 201 and one 409
    approve-vs-cancel B approves while A cancels          expect one outcome
    approve-vs-deny   B approves and denies at once       expect one 200 and one 400

The status codes each side received are recorded as named Locust requests and in
the summary printed at the end. Bodies are never printed. A 500 is a failure.
Where the final state breaks a rule from the guide, a request named
"invariant: ..." is reported as a failure so it shows in the failures table.

POST /api/requests is limited to 10 an hour per address as shipped, so rounds are
paced by a budget (LOADTEST_REQUEST_BUDGET, default 8 an hour).

    locust -f loadtest/races.py RaceUser --host https://staging.attayyibun.com \\
        --headless -u 1 -r 1 -t 2h
"""

import itertools
import os

import gevent
from gevent.event import Event
from locust import constant, task
from locust.clients import HttpSession

from common import (
    POOL,
    REQUEST_BUDGET,
    TALLY,
    StagingUser,
    abort_run,
    check,
    json_body,
    set_session_cookie,
)

# Hook for the shared/<token> race. The token is not returned by any single-purpose
# endpoint, so a person supplies tokens: a file with one token per line. Leave unset
# to skip that race. (Code note: GET /api/requests/outgoing and /incoming currently
# include oneTimeToken in each row; see README. Nothing here reads it from there.)
TOKEN_FILE = os.environ.get("LOADTEST_TOKEN_FILE")


def _pair(fn_a, fn_b):
    """Run two callables as close together as possible; return (result_a, result_b)."""
    go = Event()

    def wrapped(fn):
        go.wait()
        return fn()

    ga, gb = gevent.spawn(wrapped, fn_a), gevent.spawn(wrapped, fn_b)
    gevent.sleep(0)  # let both reach go.wait()
    go.set()
    gevent.joinall([ga, gb], timeout=60)
    return (ga.value if ga.successful() else (0, None)), (gb.value if gb.successful() else (0, None))


class RaceUser(StagingUser):
    wait_time = constant(1)

    def __init__(self, environment):
        super().__init__(environment)
        self._rounds = itertools.cycle(("double-post", "approve-vs-cancel", "approve-vs-deny"))

    # ---- setup -----------------------------------------------------------

    def _session(self, cookie):
        s = HttpSession(base_url=self.host, request_event=self.environment.events.request, user=self)
        s.headers.update(self.client.headers)
        s.max_redirects = 0
        set_session_cookie(s, cookie)
        return s

    def on_start(self):
        pair = POOL.acquire_pair()
        if pair is None:
            abort_run(self, "need a free pool pair (one brother, one sister) for each race user")
        self.a, self.b = pair  # a = requester, b = target
        # Two sessions per side so each call of a pair has its own connection.
        self.a1, self.a2 = self._session(self.a["cookie"]), self._session(self.a["cookie"])
        self.b1, self.b2 = self._session(self.b["cookie"]), self._session(self.b["cookie"])
        for s in (self.a1, self.a2, self.b1, self.b2):
            self._call(s, "GET", "/api/session/health", "race warm-up", 200)  # opens the connection
        self._cancel_pending()

    def on_stop(self):
        if getattr(self, "a", None):
            self._cancel_pending()
            POOL.release(self.a)
            POOL.release(self.b)

    # ---- helpers ---------------------------------------------------------

    def _call(self, session, method, path, name, ok, **kw):
        """One named request. Returns (status, parsed json or None)."""
        with session.request(method, path, name=name, catch_response=True, **kw) as r:
            passed = check(r, ok, name)
            status = r.status_code
            return status, (json_body(r) if passed else None)

    def _outgoing(self):
        status, body = self._call(self.a1, "GET", "/api/requests/outgoing", "race outgoing", 200)
        return body if isinstance(body, list) else None

    def _state_of(self, request_id):
        """Status of A's request, 'gone' if the row no longer exists, or None if unknown."""
        rows = self._outgoing()
        if rows is None:
            return None
        for row in rows:
            if isinstance(row, dict) and row.get("id") == request_id:
                return str(row.get("status"))
        return "gone"

    def _cancel_pending(self):
        status, body = self._call(self.a1, "GET", "/api/requests/active", "race active", 200)
        if isinstance(body, dict) and body.get("id"):
            self._call(self.a1, "DELETE", f"/api/requests/{body['id']}", "race cleanup cancel", {200, 400, 404})

    def _invariant(self, name, broken, detail):
        """Report a rule check as a Locust request: a failure when broken."""
        self.environment.events.request.fire(
            request_type="RACE", name=f"invariant: {name}", response_time=0, response_length=0,
            exception=AssertionError(detail) if broken else None, context={},
        )

    def _setup_request(self):
        """A posts one request to B. Returns its id, or None."""
        REQUEST_BUDGET.wait_take(1)
        status, body = self._call(self.a1, "POST", "/api/requests", "race setup POST /requests", 201,
                                  json={"targetPublicId": self.b["publicId"]})
        return body.get("id") if isinstance(body, dict) else None

    # ---- the races -------------------------------------------------------

    @task
    def one_round(self):
        kind = next(self._rounds)
        self._cancel_pending()
        {"double-post": self._double_post,
         "approve-vs-cancel": self._approve_vs_cancel,
         "approve-vs-deny": self._approve_vs_deny}[kind]()

    def _double_post(self):
        REQUEST_BUDGET.wait_take(2)
        body = {"targetPublicId": self.b["publicId"]}
        name = "race1 double POST /requests"
        (s1, d1), (s2, d2) = _pair(
            lambda: self._call(self.a1, "POST", "/api/requests", name, {201, 409}, json=body),
            lambda: self._call(self.a2, "POST", "/api/requests", name, {201, 409}, json=body),
        )
        TALLY.add("double-post: statuses received", "+".join(str(s) for s in sorted((s1, s2))))
        created = [d["id"] for d in (d1, d2) if isinstance(d, dict) and d.get("id")]
        rows = self._outgoing()
        if rows is not None:
            pending = [r for r in rows if isinstance(r, dict) and r.get("status") == "PENDING"]
            self._invariant("double-post leaves exactly one pending row",
                            len(pending) != 1 or len(created) != 1,
                            f"{len(created)} created (201), {len(pending)} pending rows; statuses {s1},{s2}")
        self._cancel_pending()

    def _approve_vs_cancel(self):
        request_id = self._setup_request()
        if not request_id:
            return
        name_ok = "race2 approve PUT /requests/:id/respond"
        name_cancel = "race2 cancel DELETE /requests/:id"
        (sa, _), (sc, _) = _pair(
            lambda: self._call(self.b1, "PUT", f"/api/requests/{request_id}/respond", name_ok,
                               {200, 400, 404}, json={"approved": True, "shareItems": ["phone"]}),
            lambda: self._call(self.a1, "DELETE", f"/api/requests/{request_id}", name_cancel, {200, 400, 404}),
        )
        final = self._state_of(request_id)
        TALLY.add("approve-vs-cancel: approve / cancel / final state", f"{sa} / {sc} / {final}")
        if final is not None:
            self._invariant("approve-vs-cancel: no approved row after a cancel the requester saw succeed",
                            sc == 200 and final == "APPROVED", f"cancel {sc}, approve {sa}, final {final}")
            self._invariant("approve-vs-cancel: approve not answered 200 for a request that was cancelled",
                            sa == 200 and sc == 200 and final == "gone",
                            f"approve {sa} and cancel {sc} both succeeded, row is gone")
        self._cancel_pending()

    def _approve_vs_deny(self):
        request_id = self._setup_request()
        if not request_id:
            return
        path = f"/api/requests/{request_id}/respond"
        (sa, _), (sd, _) = _pair(
            lambda: self._call(self.b1, "PUT", path, "race3 approve PUT /requests/:id/respond", {200, 400},
                               json={"approved": True, "shareItems": ["phone"]}),
            lambda: self._call(self.b2, "PUT", path, "race3 deny PUT /requests/:id/respond", {200, 400},
                               json={"approved": False}),
        )
        final = self._state_of(request_id)
        TALLY.add("approve-vs-deny: approve / deny / final state", f"{sa} / {sd} / {final}")
        self._invariant("approve-vs-deny: only one side is answered 200", sa == 200 and sd == 200,
                        f"approve {sa} and deny {sd} both answered 200, final {final}")
        self._cancel_pending()

    # ---- HOOK: shared/<token> race, only with LOADTEST_TOKEN_FILE ----------
    # Two readers open the same one-time link at once. It should work once.
    # Not run unless a token file is supplied. Statuses only; contact details are
    # never read or printed.

    if TOKEN_FILE:

        @task
        def shared_token_race(self):
            token = self._next_token()
            if token is None:
                return
            path = f"/api/requests/shared/{token}"
            name = "race4 GET /requests/shared/:token"
            (s1, _), (s2, _) = _pair(
                lambda: self._call(self.a1, "GET", path, name, {200, 400, 404}),
                lambda: self._call(self.a2, "GET", path, name, {200, 400, 404}),
            )
            TALLY.add("shared-token: statuses received", "+".join(str(s) for s in sorted((s1, s2))))
            self._invariant("shared-token: link works only once", s1 == 200 and s2 == 200,
                            f"both readers got {s1} and {s2}")

        _tokens = None

        def _next_token(self):
            cls = type(self)
            if cls._tokens is None:
                with open(TOKEN_FILE) as f:
                    cls._tokens = [line.strip() for line in f if line.strip()]
            return cls._tokens.pop() if cls._tokens else None
