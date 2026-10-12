# Deployment (attayyibun.com)

Checked 2026-10-13. Source of truth: the infra repo at `../infra`
(`Phet/infra`, GitHub `Novice130/infra`). Read `docs/runbook.md` there before
any deployment work.

## Current state

- **attayyibun.com is served by the Hetzner VPS** (moved 2026-10-13). Check:
  `curl -sI https://attayyibun.com | grep -i x-served-by` prints `hetzner`.
- The GMKtec Dokploy copy (VM 201) still runs and is the rollback target until
  it becomes staging. Switch with `CF=<token> bin/dns-switch attayyibun hetzner|gmktec`.
- Dokploy is no longer the production path. `docs/TEMP-hosting-current-status.local.md`
  and the other `docs/TEMP-*.local.md` files are snapshots from 2026-10-12,
  before the move, and describe the GMKtec as production. They are out of date.

## How deployment works

- Server: 4 GB Hetzner VPS, Docker Engine + Compose, no panel, no Swarm, no
  builds on the server. One shared Caddy (`infra/hetzner/caddy/`) is the only
  public listener, on 443, admitted only from Cloudflare.
- Compose project `attayyibun`: `web` (3000), `api` (3001, served under `/api`),
  `redis`. Definition: `infra/hetzner/sites/attayyibun/compose.yml`.
- Images: `ghcr.io/novice130/at-tayyibun-web:prod-<tag>` and
  `ghcr.io/novice130/at-tayyibun-api:<tag>`. The tag now deployed is `0000000`,
  the old Dokploy builds retagged. No registry-built image exists yet and the
  build path is not decided, so there is no previous tag to roll back to.
- Secrets live in `/opt/sites/attayyibun/` on the server: `.env`
  (`REDIS_PASSWORD`), `web.env`, `api.env` (mode 600, root only). Variable names
  are in `infra/hetzner/sites/attayyibun/*.example`. Rotation:
  `docs/SECURITY-ROTATION.md` and `docs/infra-hardening.md`.
- Operations, from the Mac, in the infra repo:

  ```sh
  bin/prod status
  bin/prod deploy attayyibun <sha>
  bin/prod rollback attayyibun
  bin/prod maintenance on|off attayyibun
  ```

  `bin/prod` runs over SSH as `root@hetzner-prod` (Tailscale) with
  `~/.ssh/hetzner_key`. Public port 22 is closed.
- `.github/workflows/deploy.yml` in this repo is not used for production.
- Health check: `https://attayyibun.com/api/session/health`.

No secrets belong in this repo. Real values are on the server and in the
password manager.
