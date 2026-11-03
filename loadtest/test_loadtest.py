"""Offline checks for the load-test code. Sends no traffic.

    LOADTEST_LOCAL=1 python -m unittest loadtest/test_loadtest.py
"""

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

os.environ["LOADTEST_LOCAL"] = "1"
os.environ["LOADTEST_POOL_FILE"] = "/nonexistent/accounts.jsonl"
os.environ["LOADTEST_BYPASS_SECRET"] = "s" * 40
sys.path.insert(0, str(Path(__file__).parent))

import common  # noqa: E402
import shapes  # noqa: E402


class Guard(unittest.TestCase):
    def test_allows_staging_and_local_port(self):
        common.assert_staging("https://staging.attayyibun.com")
        common.assert_staging("http://localhost:3001")
        common.assert_staging("http://127.0.0.1:3001/")

    def test_refuses_everything_else(self):
        for host in ("https://attayyibun.com", "https://www.attayyibun.com", "http://localhost.evil.example:3001",
                     "http://localhost:3001@attayyibun.com", "https://localhost:3001", "", None):
            with self.assertRaises(SystemExit, msg=host):
                common.assert_staging(host)


class Person(unittest.TestCase):
    def test_required_marital_answers_are_present_and_valid(self):
        for _ in range(300):
            p = common.new_person()
            self.assertIn(p["maritalStatus"], common.MARITAL_STATUSES)
            self.assertIsInstance(p["hasChildren"], bool)
            self.assertEqual(p["childrenCount"] is None, not p["hasChildren"])
            if p["maritalStatus"] == "NEVER_MARRIED":
                self.assertFalse(p["hasChildren"])
            self.assertTrue(p["email"].endswith("@loadtest.invalid"))


class Match(unittest.TestCase):
    OPEN = {"openToDivorced": True, "openToWidowed": True, "openToChildren": True}

    def test_never_married_without_children_match(self):
        self.assertTrue(common.is_mutual_match({"maritalStatus": "NEVER_MARRIED"}, {"maritalStatus": "NEVER_MARRIED"}))

    def test_is_two_way(self):
        divorced = {"maritalStatus": "DIVORCED", **self.OPEN}
        self.assertFalse(common.is_mutual_match(divorced, {"maritalStatus": "NEVER_MARRIED"}))
        self.assertTrue(common.is_mutual_match(divorced, {"maritalStatus": "NEVER_MARRIED", **self.OPEN}))

    def test_children_need_openness(self):
        parent = {"maritalStatus": "WIDOWED", "hasChildren": True, **self.OPEN}
        self.assertFalse(common.is_mutual_match(parent, {"openToWidowed": True}))

    def test_unanswered_means_never_married(self):
        self.assertTrue(common.is_mutual_match({}, {}))

    def test_pool_targets_are_opposite_gender_matches(self):
        pool = common.Pool(Path("/nonexistent"))
        pool._accounts = [
            {"email": "a", "gender": "MALE", "maritalStatus": "NEVER_MARRIED"},
            {"email": "b", "gender": "FEMALE", "maritalStatus": "NEVER_MARRIED"},
            {"email": "c", "gender": "FEMALE", "maritalStatus": "DIVORCED"},
            {"email": "d", "gender": "MALE", "maritalStatus": "NEVER_MARRIED"},
        ]
        self.assertEqual([a["email"] for a in pool.others(pool._accounts[0])], ["b"])
        first, second = pool.acquire_pair()
        self.assertNotEqual(first["gender"], second["gender"])
        self.assertTrue(common.is_mutual_match(first, second))


class Headers(unittest.TestCase):
    def test_bypass_header_sent_when_set(self):
        self.assertEqual(common.request_headers()[common.BYPASS_HEADER], "s" * 40)

    def test_bypass_header_absent_when_unset(self):
        saved = os.environ.pop("LOADTEST_BYPASS_SECRET")
        try:
            self.assertNotIn(common.BYPASS_HEADER, common.request_headers())
        finally:
            os.environ["LOADTEST_BYPASS_SECRET"] = saved


class Counting(unittest.TestCase):
    def test_buckets_are_separate(self):
        self.assertEqual(common.status_class(401), "401 unauthorized")
        self.assertEqual(common.status_class(429), "429 rate limited")
        self.assertEqual(common.status_class(500), "5xx server error")
        self.assertEqual(common.status_class(503), "5xx server error")
        for status in (200, 301, 404, 410):
            self.assertIsNone(common.status_class(status))

    def test_response_hook_counts(self):
        common.count_response(SimpleNamespace(status_code=503))
        counts = common.TALLY.snapshot()
        self.assertGreaterEqual(counts[("all responses by status", "5xx server error")], 1)
        self.assertGreaterEqual(counts[("all responses by status", "total")], 1)

    def test_thresholds(self):
        stats = SimpleNamespace(get_response_time_percentile=lambda p: 900 if p == 0.95 else 1500, fail_ratio=0.02)
        env = {"LOADTEST_MAX_P95_MS": "800", "LOADTEST_MAX_P99_MS": "2000", "LOADTEST_MAX_FAIL_PCT": "1"}
        broken = common.thresholds_broken(stats, env)
        self.assertEqual(len(broken), 2)
        self.assertTrue(any("P95" in line for line in broken))
        self.assertTrue(any("FAIL_PCT" in line for line in broken))
        self.assertEqual(common.thresholds_broken(stats, {}), [])


class Shapes(unittest.TestCase):
    def test_stress_steps(self):
        steps = shapes.SCENARIOS["stress"]
        self.assertEqual(shapes.step_at(steps, 0)[0], 60)
        self.assertEqual(shapes.step_at(steps, 600)[0], 120)
        self.assertEqual(shapes.step_at(steps, 1200)[0], 200)
        self.assertEqual(shapes.step_at(steps, 1800)[0], 300)
        self.assertIsNone(shapes.step_at(steps, 2400))

    def test_spike_steps(self):
        steps = shapes.SCENARIOS["spike"]
        self.assertEqual([shapes.step_at(steps, t)[0] for t in (0, 60, 359, 360)], [10, 150, 150, 10])
        self.assertIsNone(shapes.step_at(steps, 480))

    def test_stop_limits(self):
        self.assertFalse(shapes.over_limit(2000, 0.05))
        self.assertTrue(shapes.over_limit(2001, 0))
        self.assertTrue(shapes.over_limit(100, 0.051))
        self.assertFalse(shapes.over_limit(None, None))


if __name__ == "__main__":
    unittest.main()
