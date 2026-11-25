# Security scanning

How to re-run the scans. This file holds no findings and no values: the repo is
public. Keep reports outside the repo and never paste them into issues.

Always pass `--redact` (or never open the `Secret`/`Match` fields) for secret scans.

## Secrets in history

```sh
gitleaks git . --redact --report-format json --report-path /tmp/gitleaks.json
jq -r '.[] | [.RuleID, .Commit[0:7], .File] | @tsv' /tmp/gitleaks.json
```

CI runs the same scan on new commits only (`ci.yml`, job `gitleaks`). Anything
real found in history must be rotated first (`docs/SECURITY-ROTATION.md`);
rewriting history does not un-leak a public secret.

## Static analysis

```sh
semgrep scan --config auto --json -o /tmp/semgrep.json apps/
```

Read the cited code before acting; `ERROR` results first.

## Dependencies

```sh
pnpm audit --prod
```

Dependabot (`.github/dependabot.yml`) opens weekly grouped PRs for npm, pub,
docker and github-actions.

## Container images

Scan the images that are deployed, not only the source:

```sh
trivy image --severity HIGH,CRITICAL --format json -o /tmp/trivy-api.json ghcr.io/novice130/at-tayyibun-api:<tag>
trivy image --severity HIGH,CRITICAL --format json -o /tmp/trivy-web.json ghcr.io/novice130/at-tayyibun-web:prod-<tag>
```

Triage by whether the package is in the runtime path (app code and its
dependencies) or only in build tooling (pnpm, npm, esbuild binaries).

## Headers and TLS

```sh
curl -s "https://observatory-api.mdn.mozilla.net/api/v2/scan?host=<host>" -X POST
```

SSL Labs: https://www.ssllabs.com/ssltest/ (the API returns `IN_PROGRESS` until
every endpoint finishes; re-poll before reading a grade).

## Dynamic scan (staging only)

Passive baseline, never against production:

```sh
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://staging.attayyibun.com
```

## Infra configuration

```sh
trivy config <path to infra repo>/hetzner
```
