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

### Cancel-earn feature flag

`ENABLE_CANCEL_EARN` is an **Application env var**, same as `APP_ENV` and `DATABASE_URL`. Set it on each Cloudera Application. Unset defaults to enabled.

| Instance | `ENABLE_CANCEL_EARN` |
|----------|----------------------|
| Local | `true` (or unset) |
| Production | `true` |
| Staging | `false` |

When enabled, an earn row can be fully or partially cancelled while it still has unexpired points remaining. Redeemed points cannot be cancelled; after a partial redemption, only that earn's remaining points are cancellable. `/api/meta` reports `featureFlags.enable_cancel_earn`.

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
| `SEED_DEMO_DATA` | `true` only for local/staging |
| `APP_VERSION` / `GIT_TAG` / `GIT_SHA` / `DEPLOYED_AT` | Injected at deploy |

## Expire job

`expire-lots` runs every minute inside the Next.js Node process (`lib/expire-job.ts`, started on boot). Balance truth never waits on the job: lots with `expires_at <= now` are not spendable even before the `EXPIRE` row is written.

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
