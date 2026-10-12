# Infrastructure hardening runbook

Scope: attayyibun.com and modestummah.com, self-hosted as Docker containers (Dokploy +
Traefik) in a VM on Proxmox VE, with Neon Postgres. Written 2026-10-12.

Nothing here has been applied to the VM, Proxmox or Neon. Each section ends with a
check you can run. Do the sections in the order under "Order" at the bottom.

Placeholders used below: `<PVE_IP>` Proxmox host, `<LAN_CIDR>` home/office subnet
(e.g. `192.168.1.0/24`), `<GW_IP>` gateway/DNS, `<ADMIN_IP>` the machine you administer
from.

---

## 1. Neon: limit what a leaked connection string can do

### 1.1 One Neon project per site

Roles and passwords are scoped to a project. With attayyibun and modestummah in
separate projects, a URL stolen from one site cannot reach the other's data. Two
databases inside one project is weaker: the owner role can connect to both.

### 1.2 Roles

| Role | Used as | Rights |
|---|---|---|
| `migrator` | API `MIGRATION_DATABASE_URL` | owns tables, DDL |
| `app_api` | API `DATABASE_URL` | SELECT/INSERT/UPDATE/DELETE on `public` |
| `app_web` | Web `DATABASE_URL` | DML on the five BetterAuth tables only |
| `neondb_owner` | nowhere on the VM | break-glass, password reset and stored offline |

The web container only touches `users`, `session`, `account`, `verification` and
`two_factor` (`apps/web/src/lib/db-schema.ts`, used from `auth.ts` and
`phone-verify.ts`).

Create roles with SQL, not the Neon Console or API: roles created there are added to
`neon_superuser`.

**Try this on a Neon branch of production first**, point a local API at the branch, and
only then repeat on the production branch. Run as `neondb_owner`:

```sql
-- 1. Roles (generate each password with: openssl rand -base64 36)
CREATE ROLE migrator LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE app_api  LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE app_web  LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 2. migrator takes over the schema. drizzle's migrator issues
--    CREATE SCHEMA IF NOT EXISTS, which needs CREATE on the database even when
--    the schema already exists.
GRANT migrator TO CURRENT_USER;
GRANT CREATE ON DATABASE neondb TO migrator;          -- use your database name
GRANT USAGE, CREATE ON SCHEMA public, drizzle TO migrator;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname IN ('public', 'drizzle') LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO migrator', r.schemaname, r.tablename);
  END LOOP;
  FOR r IN SELECT n.nspname, t.typname FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO migrator', r.nspname, r.typname);
  END LOOP;
END $$;
ALTER SCHEMA drizzle OWNER TO migrator;

-- 3. Runtime roles: data only
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_api, app_web;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.users, public.session, public.account, public.verification, public.two_factor
  TO app_web;

-- 4. Tables added by future migrations stay usable by the API
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_api;
```

A migration that adds a table the web app needs must include its own
`GRANT ... TO app_web`.

Shortcut if the ownership transfer gives trouble: skip `migrator`, keep `neondb_owner`
as `MIGRATION_DATABASE_URL`, and change step 4 to `FOR ROLE neondb_owner`. The server
process still runs DML-only, which is most of the benefit.

### 1.3 Wire it into Dokploy

- API app: `DATABASE_URL` = `app_api` URL, `MIGRATION_DATABASE_URL` = `migrator` URL.
  `Dockerfile.api` runs the migration with the second, then unsets it before starting
  the server (`apps/api/src/migrate.ts`). Leaving `MIGRATION_DATABASE_URL` empty keeps
  the old single-URL behaviour.
- Web app: `DATABASE_URL` = `app_web` URL.
- Reset the `neondb_owner` password and remove it from every Dokploy app and local
  `.env`.

### 1.4 Give each container only the variables it reads

From the code as of this date:

| Variable | Web | API |
|---|---|---|
| `DATABASE_URL` | yes (`app_web`) | yes (`app_api`) |
| `MIGRATION_DATABASE_URL` | no | yes |
| `BETTER_AUTH_SECRET` | yes | yes |
| `ENCRYPTION_KEY` | **no** | yes |
| `REDIS_URL`, `GCS_*` | no | yes |
| `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | yes | **no** |
| `GOOGLE_CLIENT_SECRET` | yes | **no** |
| `APPLE_CLIENT_SECRET`, `RESEND_API_KEY` | yes | yes |

Remove anything marked **no** from that app's Dokploy environment. Keeping
`ENCRYPTION_KEY` out of the internet-facing web container matters most: with it, a web
compromise could decrypt the PII columns it can read. Do not use Dokploy project-level
shared variables across the two sites. Neon API keys and Console logins never go on
the VM.

### 1.5 Network

- Neon IP Allow: restrict to the VM's public egress IP (plan-dependent feature).
- Mark the production branch as protected.
- TLS verification is already enforced (`ssl: { rejectUnauthorized: true }`).

**Check**

```sql
-- as app_api: both must fail with "permission denied"
CREATE TABLE public.x (id int);
DROP TABLE public.users;
-- as app_web: must fail
SELECT 1 FROM public.profiles LIMIT 1;   -- any non-auth table
```

Then deploy and confirm the API log shows `[migrate] up to date`, and that login,
signup, phone verification and admin 2FA still work.

---

## 2. Containers cannot reach each other across sites

Dokploy attaches every application to one shared overlay network
(`dokploy-network`) by default, so attayyibun, modestummah, Traefik and any Redis can
all talk to each other directly.

- Give each site its own internal network and attach only the services Traefik must
  reach to the proxy network. With Dokploy Compose deployments, enable **Isolated
  Deployment**; the shape is:

  ```yaml
  services:
    web:
      networks: [proxy, internal]
    api:
      networks: [proxy, internal]
    redis:
      command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
      networks: [internal]
  networks:
    proxy:
      external: true
      name: dokploy-network
    internal:
      internal: true          # no route out, not shared with the other site
  ```

  Services that share `dokploy-network` can still reach each other on it. To close
  that fully, the two sites need separate proxy-facing networks, each also attached to
  Traefik.
- No `ports:` on any app, Redis or database container. Traefik on 80/443 is the only
  listener.
- Docker socket: never mount `/var/run/docker.sock` into an app container; it is root
  on the VM. Dokploy and Traefik need it. Where your Dokploy version allows editing the
  Traefik service, put `tecnativa/docker-socket-proxy` in front with `CONTAINERS=1`,
  `SERVICES=1`, `TASKS=1`, `NETWORKS=1` and everything else `0`.
- Dokploy panel: it holds every secret in plaintext and controls the socket. Take
  `:3000` and the `dokploy.learnnovice.com` route off the public internet and reach it
  through Tailscale/WireGuard or `ssh -L 3000:localhost:3000`. Turn on 2FA, rotate its
  API tokens, delete tokens used by MCP integrations you no longer need.
- `/etc/docker/daemon.json`: `"icc": false` (covers the default bridge only; nothing
  should run there).

**Check** (from inside the attayyibun web container)

```sh
wget -T3 -qO- http://<modestummah-service>:3000   # must time out / not resolve
ls /var/run/docker.sock                           # must not exist
```

From outside: `nmap -Pn <public-ip>` shows only 80 and 443.

---

## 3. Containers cannot escalate to the VM

Already in place: both images run as uid 1001, are multi-stage, and never run
privileged.

Add per service (Dokploy advanced settings, or Compose):

```yaml
read_only: true
tmpfs:
  - /tmp
  # web only: Next.js image optimisation and ISR write here
  - /app/apps/web/.next/cache:uid=1001,gid=1001
cap_drop: [ALL]
security_opt: ["no-new-privileges:true"]
pids_limit: 256
deploy:
  resources:
    limits: { memory: 1g, cpus: "1.0" }
```

Swarm services ignore `security_opt`, so also set it for the whole daemon in
`/etc/docker/daemon.json`, then `systemctl restart docker`:

```json
{
  "no-new-privileges": true,
  "icc": false,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

Never use: `privileged: true`, `pid: host`, `network_mode: host`, `cap_add`, or bind
mounts of `/`, `/etc`, `/var/run`. Keep the default seccomp and AppArmor profiles.
Enable unattended security upgrades on the VM: real container escapes are kernel and
runc bugs.

Apply `read_only` to one service at a time and watch the logs for `EROFS`.

**Check**

```sh
docker inspect <container> --format \
  '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} capdrop={{.HostConfig.CapDrop}} {{.HostConfig.SecurityOpt}}'
docker exec <container> touch /app/x     # must fail
```

---

## 4. The VM cannot reach Proxmox or the LAN

Strongest option: put the web VM on its own VLAN or bridge with no route to the
management subnet. The rules below work with or without that.

### 4.1 Proxmox firewall (enforced outside the VM)

This holds even if an attacker gets root inside the VM.

> **Warning:** enabling the Datacenter firewall with a wrong policy locks you out of
> the Proxmox web UI and SSH. First add host-level rules allowing `<ADMIN_IP>` to TCP
> 8006 and 22, and keep a physical or IPMI console available.

1. Datacenter → Firewall → Options → enable. Node → Firewall → rules for `<ADMIN_IP>`
   to 8006 and 22.
2. VM → Hardware → Network device → tick **Firewall**.
3. VM → Firewall → Options: enable, input policy DROP, output policy DROP, IP filter
   on, MAC filter on.
4. VM → Firewall → rules, in this order:

| # | Dir | Action | Source / Dest | Proto / Port | Why |
|---|---|---|---|---|---|
| 1 | OUT | DROP | dest `<PVE_IP>` | all | blocks 8006, 22, 3128, VNC |
| 2 | OUT | ACCEPT | dest `<GW_IP>` | udp+tcp 53 | DNS |
| 3 | OUT | DROP | dest 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 | all | no LAN access |
| 4 | OUT | ACCEPT | any | tcp 80, 443, 5432 | registries, APIs, Neon |
| 5 | OUT | ACCEPT | any | udp 123 | NTP |
| 6 | IN | ACCEPT | any (or Cloudflare ranges) | tcp 80, 443 | public web |
| 7 | IN | ACCEPT | source `<ADMIN_IP>` or VPN | tcp 22 | SSH |

On the Proxmox host itself: no router port-forward to 8006, 2FA on `root@pam`, API
tokens rather than the root password for automation.

### 4.2 Inside the VM (second layer)

```sh
ufw default deny incoming
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from <ADMIN_IP> to any port 22 proto tcp
ufw enable
```

SSH: keys only, `PermitRootLogin no`, `PasswordAuthentication no`.

UFW does not filter traffic to Docker-published ports or traffic forwarded from
containers. That goes through the `DOCKER-USER` chain:

```sh
iptables -I DOCKER-USER -d <PVE_IP> -j DROP
iptables -I DOCKER-USER -d <LAN_CIDR> -m conntrack --ctstate NEW -j DROP
apt install iptables-persistent && netfilter-persistent save
```

Use the real LAN subnet here, not all of RFC1918: Docker's own bridge and overlay
networks live in 172.16.0.0/12 and 10.0.0.0/8.

The sites are behind Cloudflare, so also restrict inbound 80/443 to Cloudflare's
published ranges, or move to Cloudflare Tunnel and close inbound entirely. Otherwise
the origin IP can be attacked directly, bypassing Cloudflare.

**Check** (run on the VM, then again inside a container)

```sh
nc -zv -w3 <PVE_IP> 8006        # must time out
nc -zv -w3 <PVE_IP> 22          # must time out
nc -zv -w3 <other-LAN-host> 80  # must time out
curl -sI https://attayyibun.com # must still work
```

---

## Order

1. Confirm every item in `docs/SECURITY-ROTATION.md` is rotated and tick it off.
2. Dokploy panel off the public internet (§2).
3. Neon roles and per-container variables (§1), then deploy.
4. Proxmox firewall (§4.1), then VM firewall (§4.2).
5. Network isolation and container flags (§2, §3), one service at a time.
