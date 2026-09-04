# Points Engine — Admin Loyalty App

Staff-only loyalty program: create members, log activities that award points, redeem, and see when remaining points expire. Members do not log in.

Behavior follows [`docs/SPEC.md`](docs/SPEC.md). Program settings (expiration interval, timezone, tier rules) live in a **JSON file per instance**, not in MySQL. `GET /api/meta` is public so other systems (including ClouderaAI) can read version + settings without logging in.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + **MySQL 5.7.40** locally (Homebrew `mysql@5.7`)
- Session cookie + bcrypt
- JSON file on the instance filesystem for program settings
- In-process expire job every minute (`setInterval` on the Node server) to post `EXPIRE` ledger rows

## Local setup

MySQL 5.7 must be running (`bind-address` 127.0.0.1 is fine):

```bash
/usr/local/opt/mysql@5.7/bin/mysql.server start
mysql -h 127.0.0.1 -u root -e "CREATE DATABASE IF NOT EXISTS points_engine CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

```bash
cp .env.example .env
# Set SESSION_SECRET (32+ random chars) and SUPERADMIN_*
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.

If `SEED_DEMO_DATA=true`, Elena Cruz and Juan Dela Cruz are created with sample ledger rows.

### Program settings (JSON file)

| Env | `APP_ENV` | Default file |
|-----|-----------|----------------|
| Laptop | `development` | `.data/local/program-settings.json` |
| Production | `production` | `.data/production/program-settings.json` |
| Staging | `staging` | `.data/staging/program-settings.json` |

Override with `SETTINGS_FILE` when needed. **Never** point the laptop at production or staging paths.

`.data/` is gitignored. Missing files are created from the seeded defaults on first boot. `/api/meta` reports the path in `settingsSource`.

### Cancel feature flags

`ENABLE_CANCEL_EARN` and `ENABLE_CANCEL_REDEEM` are Application env vars. Unset defaults to enabled.

| Instance | Flags |
|----------|--------|
| Local | `true` (or unset) |
| Production | `true` |
| Staging | `false` |

When cancel earn is enabled, an earn row can be fully or partially cancelled while it still has unexpired remaining points. When cancel redeem is enabled, a redemption can be fully or partially cancelled while the consumed lots are still unexpired. `/api/meta` reports both flags.

### Public metadata

```bash
curl -sS http://localhost:3000/api/meta
curl -sS http://localhost:3000/api/meta/health
```

No cookie. `Cache-Control: no-store`. CORS `GET` from `*`.

`version` / `gitTag` / `gitSha` come from `APP_VERSION`, `GIT_TAG`, `GIT_SHA` at deploy. If unset, those fields are JSON `null`.

## Env vars

See `.env.example`. Production and staging each need their own `DATABASE_URL`, `APP_PUBLIC_URL`, `SESSION_SECRET`, and settings file.

| Variable | Notes |
|----------|--------|
| `APP_ENV` | `development` \| `staging` \| `production` |
| `APP_PUBLIC_URL` | Canonical URL for this instance |
| `DATABASE_URL` | MySQL 5.7-compatible URL |
| `SESSION_SECRET` | Cookie signing key (different per instance) |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Seeded only when `admins` is empty; unset the password after first deploy |
| `SETTINGS_FILE` | Optional path to this instance’s program-settings JSON |
| `ENABLE_CANCEL_EARN` | `true` / `false`. Unset = enabled. Staging should set `false` |
| `ENABLE_CANCEL_REDEEM` | `true` / `false`. Unset = enabled. Staging should set `false` |
| `SEED_DEMO_DATA` | `true` only for local/staging |
| `STAGING_CONTROL_TOKEN` | Bearer token for the Staging Control API (`127.0.0.1:3100`). Set in `deploy/mac-cloudflare/staging-control.env`, not in the Next.js app env |
| `APP_VERSION` / `GIT_TAG` / `GIT_SHA` / `DEPLOYED_AT` | Injected at deploy |

## Expire job

`expire-lots` runs every minute inside the Next.js Node process (`lib/expire-job.ts`, started on boot). Balance truth never waits on the job: lots with `expires_at <= now` are not spendable even before the `EXPIRE` row is written.

## Local prod + staging (Mac + Cloudflare Tunnel)

When you do not have Cloudera yet, run two instances on this Mac and publish them with `cloudflared`. See [`deploy/mac-cloudflare/README.md`](deploy/mac-cloudflare/README.md).

```bash
npm run build
bash scripts/mac-cloudflare/start-prod.sh              # 127.0.0.1:3000
bash scripts/mac-cloudflare/start-staging.sh           # 127.0.0.1:3001
bash scripts/mac-cloudflare/start-staging-control.sh   # 127.0.0.1:3100
bash scripts/mac-cloudflare/tunnel.sh prod
bash scripts/mac-cloudflare/tunnel.sh staging
bash scripts/mac-cloudflare/tunnel.sh control
```

Equivalent npm script for the control service: `npm run start:staging-control` (or `npm run staging-control` if `STAGING_CONTROL_TOKEN` is already in the environment).

## Staging Control API

A separate Node service for the Ready, Set, Repro! Environment Setup Agent. It binds **only** to `127.0.0.1:3100` and can change Staging **program settings** (expiration interval, timezone, tiers) and the two Staging **feature flags** (`ENABLE_CANCEL_EARN`, `ENABLE_CANCEL_REDEEM`). It never reads, writes, restarts, or calls Production. Secrets and bind settings in `.env` (`DATABASE_URL`, `SESSION_SECRET`, `HOST`, `PORT`, `APP_ENV`, passwords) are not writable.

Auth: `Authorization: Bearer $STAGING_CONTROL_TOKEN` from `deploy/mac-cloudflare/staging-control.env` (gitignored). Copy the example file and set a long random token — do not commit a real token.

```bash
# Token from deploy/mac-cloudflare/staging-control.env (never commit this file)
TOKEN="$(grep '^STAGING_CONTROL_TOKEN=' deploy/mac-cloudflare/staging-control.env | cut -d= -f2-)"

curl -sS -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:3100/health

curl -sS -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:3100/status

curl -sS -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"manual-dry-run-001","dry_run":true,"changes":{"enable_cancel_earn":true,"expiration_interval":"1_year"}}' \
  http://127.0.0.1:3100/setup
```

`dry_run: true` does not write files or restart Staging. A real `POST /setup` (no dry run) updates `deploy/mac-cloudflare/staging.env` and `.data/staging/program-settings.json`, restarts Staging via a fixed internal script, waits for `http://127.0.0.1:3001/health`, then returns staging `/api/meta`. There is no generic shell endpoint. The control Cloudflare hostname changes on every `cloudflared` restart. Never put `STAGING_CONTROL_TOKEN` in a URL, commit, or log.

## Deploy on Cloudera AI (prod + staging)

Same git repo, **two Workbench Applications**, two public URLs, two databases, two settings files. Each Application is its own engine (process). Do not run one Next.js process and switch `APP_ENV`.

Workbench hosts the web app. It does **not** provide MySQL. Point each `DATABASE_URL` at a MySQL 5.7-compatible server the engines can reach (two databases on one server is fine: `points_prod` and `points_staging`).

### 1. Project

Create a Cloudera AI project and clone this repository into it.

### 2. Databases (once)

From a Workbench session that can reach MySQL:

```bash
npx prisma db push
# staging only, if you want demo members:
# SEED_DEMO_DATA=true npx prisma db seed
```

Run that against **each** database (`DATABASE_URL` for prod, then staging). Or set `PRISMA_DB_PUSH=true` on the first Application start only.

### 3. Two Applications

**Applications → New Application** twice. Script: `scripts/cloudera-start.py` (Python 3 kernel). The script starts Next.js on `127.0.0.1:$CDSW_APP_PORT`.

**Production**

| Field | Example |
|-------|---------|
| Name | Points Engine Prod |
| Subdomain | `points-prod` |
| `APP_ENV` | `production` |
| `APP_PUBLIC_URL` | `https://points-prod.<workbench-domain>` |
| `DATABASE_URL` | `mysql://.../points_prod` |
| `SESSION_SECRET` | unique long string |
| `ENABLE_CANCEL_EARN` | `true` |
| `ENABLE_CANCEL_REDEEM` | `true` |
| `SEED_DEMO_DATA` | `false` |

**Staging**

| Field | Example |
|-------|---------|
| Name | Points Engine Staging |
| Subdomain | `points-staging` |
| `APP_ENV` | `staging` |
| `APP_PUBLIC_URL` | `https://points-staging.<workbench-domain>` |
| `DATABASE_URL` | `mysql://.../points_staging` |
| `SESSION_SECRET` | a **different** unique long string |
| `ENABLE_CANCEL_EARN` | `false` |
| `ENABLE_CANCEL_REDEEM` | `false` |
| `SEED_DEMO_DATA` | `true` if you want demo members |

Application-level env vars override project-level ones.

If both Applications live in **one** project they share the filesystem — `APP_ENV` already picks `.data/production/` vs `.data/staging/`. Two projects is even cleaner.

Set `GIT_TAG` / `GIT_SHA` / `APP_VERSION` so `/api/meta` tells the truth (the start script fills SHA/tag from git when unset).

### 4. Verify

- Login, create member, Create Activity, redeem, Save settings (the instance’s JSON file updates).
- `curl -sS $APP_PUBLIC_URL/api/meta` with **no cookie**. Production `environment` is `production`; staging is `staging`.
- ClouderaAI should `GET` production `/api/meta`, then drive the staging URL.

Public URLs (fill in after deploy):

- Production: _(not deployed yet)_
- Staging: _(not deployed yet)_

## Tests

```bash
npm test
```
