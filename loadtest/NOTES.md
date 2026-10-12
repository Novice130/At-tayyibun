# Load test notes: At-Tayyibun

One entry per session, newest first. Report results as they are. If a run failed or was cut short, write that.

Entry format:

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
