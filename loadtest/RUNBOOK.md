# Load test runbook: At-Tayyibun staging

Target: `https://staging.attayyibun.com` only. The scripts refuse any other host,
except `http://localhost:<port>` / `http://127.0.0.1:<port>` when `LOADTEST_LOCAL=1`.
Production is never load tested. Rules are in `GUIDE.md`; files in `README.md`.

## 0. Where the generator runs

The load generator must not run on the machine under test. Staging is on the GMKtec
(Dokploy VM 201), so run Locust from another machine. Locust is **not installed** on the
owner's Mac. Install it in its own venv (Python 3.11+; the system Python 3.9 is too old):

```sh
python3.11 -m venv ~/.venvs/locust
~/.venvs/locust/bin/pip install -r loadtest/requirements.txt
~/.venvs/locust/bin/locust --version          # locust 2.46.7
```

## 1. Owner steps before the first run

Each step is done by the owner, in the named console. Nothing here is automated.

1. **Cloudflare Access.** Create a service token (Zero Trust > Access > Service
   Auth). Add a policy with action *Service Auth* for that token on the
   `staging.attayyibun.com` application. Put the id and secret in the generator
   machine's environment as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`.
2. **WAF skip.** Add a WAF custom rule on the zone: *Skip* (all remaining custom rules,
   rate limiting rules, managed rules, Bot Fight Mode / Super Bot Fight Mode) when
   `http.host eq "staging.attayyibun.com" and any(http.request.headers["cf-access-client-id"][*] eq "<token id>")`.
   Without it Cloudflare, not the app, answers the load and the numbers are meaningless.
   Remove the rule after the session.
3. **Unset Resend on staging.** `RESEND_API_KEY` empty for both web and api in Dokploy.
   Request, approval and report flows send mail; with the key set they send real mail.
4. **Firebase test numbers.** Firebase console > Authentication > Sign-in method >
   Phone > *Phone numbers for testing*: add a few `+1 <area> 555-01NN` numbers with fixed
   codes, for the manual browser check of the phone step. Locust cannot obtain a Firebase
   ID token, so the `SignUp` journey only passes the phone step when the staging **web**
   service has `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
   unset. With them unset the server accepts any code of 10+ characters. That is acceptable
   on Access-protected staging only, and is why the pool is built by the seed script
   (step 1.9) instead.
5. **Neon size match.** The staging Neon project (`attayyibun-staging`) compute must match
   production's: same min/max CU and the same autosuspend setting (or autosuspend off for
   the session). Wake it by opening the site once before measuring.
6. **Sentry DSNs and traces.** On staging set `API_SENTRY_DSN` and `SENTRY_DSN` to the
   staging projects, and `SENTRY_TRACES_SAMPLE_RATE=0.01` (and
   `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.01` for the next web build). At the default
   0.05 a load run uses up the trace quota.
7. **Rate-limit bypass (staging only).** Generate a secret (`openssl rand -hex 32`), store
   it in the password manager, and add to **both** `api` and `web` of the staging compose:
   `APP_ENV: staging` and `LOADTEST_BYPASS_SECRET: ${LOADTEST_BYPASS_SECRET:-}`, then set
   the value in Dokploy's Environment tab. The services pass only listed variables, so the
   compose change in `infra/gmktec/sites/attayyibun-staging/compose.yml` is required.
   The bypass stays off unless `APP_ENV` is exactly `staging`, `WEB_URL`/`BETTER_AUTH_URL`
   are staging (or localhost), `SENTRY_ENVIRONMENT` is not `production` and the secret is
   32+ characters. `NODE_ENV` cannot be used for this: staging runs `NODE_ENV=production`
   too. Check the api log for `[loadtest] rate-limit bypass is ACTIVE` after redeploy.
   Leave `APP_ENV`/`LOADTEST_BYPASS_SECRET` unset at other times. Never set them on
   production.
8. **Rate-limit decision.** Without the bypass, expect 429s: limits are per signed-in user,
   otherwise per client IP, and one generator is one IP. Runs without the bypass measure the
   limiter, not capacity.
9. **Seed.** From a machine that can reach the staging Neon branch, with the staging
   values (never production's, never the root `.env`):

   ```sh
   SEED_ALLOWED_HOST=<staging Neon host> DATABASE_URL=<staging URL> \
   BETTER_AUTH_SECRET=<staging> ENCRYPTION_KEY=<staging> \
   SEED_PROFILES=5000 SEED_ACCOUNTS=250 \
     pnpm --filter @at-tayyibun/api db:seed:loadtest
   chmod 600 loadtest/accounts.jsonl
   ```

   It refuses unless the URL host equals `SEED_ALLOWED_HOST`, when the site URLs are
   production, or when the database holds more than 100 users without `.invalid` emails.
   Re-running adds nothing and renews the 250 pool sessions (30 days). It writes
   `loadtest/accounts.jsonl`, keeping lines added by `SignUp`. It reads no `.env` file.
10. **Quiet machine.** Nothing else load-heavy on the GMKtec during the session.

## 2. Environment on the generator

```sh
export CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=...   # step 1.1
export LOADTEST_BYPASS_SECRET=...                            # step 1.7; sent as X-Loadtest-Bypass
export LOADTEST_REQUEST_BUDGET=1000                          # only with the bypass
export LOADTEST_RUN_ID=load-1                                # one per run
L="locust -f loadtest/locustfile.py --host https://staging.attayyibun.com --headless"
C="Visitor Member Moderation"     # never omit: with no class named, SignUp runs too
```

Each `Member`/`Moderation` user holds its own pool account (250 seeded). Keep those users
at or under 250. `Visitor` needs none, so the higher stages are mostly visitors by weight
(3 : 5 : 1). For the 300-user stage, seed `SEED_ACCOUNTS=300` or more.

## 3. Scenarios

| Scenario | Users | Duration | Pass when | Command |
|---|---|---|---|---|
| Smoke | 1 per journey | 1 min each | 0 failures, no 401/5xx | `$L Visitor -u 1 -r 1 -t 1m` then `Member`, `Moderation`, `SignUp` (step 1.4), and `locust -f loadtest/races.py RaceUser ... -u 1 -t 3m` |
| Baseline | 10 | 5 min | record only | `$L $C -u 10 -r 2 -t 5m --csv results/baseline` |
| Load | 60 | 15 min | p95 < 800 ms, p99 < 2 s, errors < 1% | `LOADTEST_MAX_P95_MS=800 LOADTEST_MAX_P99_MS=2000 LOADTEST_MAX_FAIL_PCT=1 $L $C -u 60 -r 2 -t 15m --csv results/load --html results/load.html` |
| Stress | 60, 120, 200, 300 | 10 min each | stops itself at p95 > 2 s or errors > 5% held 30 s | `LOADTEST_SCENARIO=stress locust -f loadtest/locustfile.py,loadtest/shapes.py --host https://staging.attayyibun.com --headless $C --csv results/stress` |
| Spike | 10, then 150 for 5 min, then 10 | 8 min | back to baseline p95 within 2 min of the drop | `LOADTEST_SCENARIO=spike locust -f loadtest/locustfile.py,loadtest/shapes.py ... $C --csv results/spike` |
| Soak | 40 | 2 h | memory flat, no error growth | `$L $C -u 40 -r 2 -t 2h --csv results/soak --csv-full-history` |

The thresholds set the exit code (1 when broken, printed as `THRESHOLD BROKEN ...`). With a
shape file, `-u`/`-r`/`-t` are ignored. Stress records the user count it stopped at: that is
the result. Spike recovery is read from `results/spike_stats_history.csv`.

## 4. What to watch

- Locust summary: per-request p50/p95/p99, and the end-of-run block, which counts
  **401**, **429** and **5xx** separately, by request name and over all responses.
  401 means expired pool sessions: re-run the seed. 429 with the bypass on means the
  header is not reaching the app (check Access/WAF, then the compose variables).
- Hetzner is not involved. On the GMKtec: `docker stats` for the `attayyibun-staging`
  web/api/redis containers (memory against 512m/384m/64m limits, CPU against 1.0),
  restarts (`docker ps` uptime), and api logs for `[BetterAuthGuard]` and 5xx.
- Neon console: CPU, connections (the api pool is 10 per container), slow queries.
- Sentry staging: new errors and the slowest transactions.
- Cloudflare: `CF-Cache-Status` on `/_next/image` (cached hero images measure Cloudflare,
  not the origin) and that no 403/challenge appears (WAF skip working).
- Soak: api and web container memory every 15 min. A steady climb is a leak.

## 5. Recording

After each session add an entry to `loadtest/NOTES.md`, newest first, in the format at the
top of that file: commit sha, target, limits (`bypass on/off`), each run's users, ramp,
time, RPS, p50, p95, p99, fail %, 401/429/5xx counts, peak container memory, what broke and
at what load. Write failed or cut-short runs as they were. Attach nothing with response
bodies. Then remove the WAF skip rule, unset `LOADTEST_BYPASS_SECRET` and `APP_ENV` on
staging, and ask whether to reset the Neon `staging` branch. Do not use
`pnpm --filter api db:clean:tests`.

## 6. Local smoke (no remote traffic)

To check the scripts themselves against an API on this machine:

```sh
LOADTEST_LOCAL=1 LOADTEST_POOL_FILE=/tmp/x/accounts.jsonl \
  locust -f loadtest/locustfile.py Member --host http://127.0.0.1:3001 --headless -u 2 -t 30s
LOADTEST_LOCAL=1 python -m unittest loadtest/test_loadtest.py
```

`LOADTEST_LOCAL=1` drops the Access headers and `Origin` (the API then relies on
`X-Requested-With`). Pages and `/_next/image` need the web app, so run `Visitor` locally
only with it.
