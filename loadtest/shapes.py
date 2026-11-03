"""Stepped load shapes for the stress and spike scenarios. See RUNBOOK.md.

Add this file to -f and set LOADTEST_SCENARIO. A shape replaces -u, -r and -t:

    LOADTEST_SCENARIO=stress locust -f loadtest/locustfile.py,loadtest/shapes.py Visitor Member Moderation ...
"""

import os

from locust import LoadTestShape

# (users, spawn rate per second, seconds at this level)
SCENARIOS = {
    "stress": [(60, 2, 600), (120, 2, 600), (200, 2, 600), (300, 2, 600)],
    # Baseline, jump, hold, then two minutes back at baseline to show recovery.
    "spike": [(10, 2, 60), (150, 50, 300), (10, 50, 120)],
}
STOP_P95_MS = 2000
STOP_FAIL_RATIO = 0.05
# One bad second is noise. Stop only when it lasts.
STOP_AFTER_SECONDS = 30
SETTLE_SECONDS = 60


def step_at(steps, elapsed):
    """(users, spawn rate) for this moment, or None once the steps are finished."""
    for users, rate, duration in steps:
        if elapsed < duration:
            return users, rate
        elapsed -= duration
    return None


def over_limit(p95_ms, fail_ratio):
    return (p95_ms or 0) > STOP_P95_MS or (fail_ratio or 0) > STOP_FAIL_RATIO


class ScenarioShape(LoadTestShape):
    """Stress stops itself at p95 > 2 s or errors > 5%. Spike always runs to the end."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scenario = os.environ.get("LOADTEST_SCENARIO", "")
        if self.scenario not in SCENARIOS:
            raise SystemExit(f"set LOADTEST_SCENARIO to one of {sorted(SCENARIOS)} to use shapes.py")
        self.bad_seconds = 0
        self.last_checked = -1

    def tick(self):
        elapsed = self.get_run_time()
        if self.scenario == "stress" and elapsed > SETTLE_SECONDS and int(elapsed) != self.last_checked:
            self.last_checked = int(elapsed)
            total = self.runner.stats.total
            bad = over_limit(total.get_current_response_time_percentile(0.95), total.fail_ratio)
            self.bad_seconds = self.bad_seconds + 1 if bad else 0
            if self.bad_seconds >= STOP_AFTER_SECONDS:
                print(f"shapes: stop limit held for {STOP_AFTER_SECONDS}s at {self.get_current_user_count()} users")
                return None
        return step_at(SCENARIOS[self.scenario], elapsed)
