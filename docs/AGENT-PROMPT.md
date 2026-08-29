# Implementation prompt — Points Engine (prod + staging)

Copy everything below the line into the other agent.

---

## Mission

Build and **deploy two public internet instances** of the same admin loyalty web app from this repo:

1. **Production** — treat as the live system.
2. **Staging** — same app, separate database and program-settings JSON. This is the environment a later AI job will hit with Robot Framework (`.robot`) to reproduce bugs.

**Product behavior:** follow [`docs/SPEC.md`](docs/SPEC.md) exactly. Program settings are a JSON file per instance (§8.9). Public `GET /api/meta` is §10.1. Q33: never reset a superadmin password from Admins.

## Do not build

- Chrome extension
- Jira integration
- ClouderaAI / “Reproduce with AI” UI
- `.robot` files or a test runner that talks to Jira

Those will consume **this** app later. Your job is to make prod/staging look like a real program and expose **one simple JSON URL** so another system can read version + settings without logging in.

## Why `/api/meta` exists

A Jira ticket will include the **production URL**. An external agent will `GET {productionUrl}/api/meta` (no auth) and use:

- which **git tag / version** is in production
- the current **program settings JSON** (same payload as the instance file)

It will then drive **staging** (`APP_PUBLIC_URL` of the staging instance). Plan for that with a stable, CORS-open, unauthenticated metadata route. Do not make ClouderaAI read the settings file (or any object store) directly.

## Stack

- Next.js (App Router) + TypeScript + Prisma
- **MySQL 5.7.40** — this is what is installed on the author’s Mac (`mysql Ver 14.14 Distrib 5.7.40`, Homebrew `mysql@5.7` at `/usr/local/opt/mysql@5.7`). Develop and migrate against that. **Do not use MySQL 8-only SQL** (no CTEs, window functions, `CHECK` constraints, `utf8mb4_0900_*` collations, or `RETURNING`). `DATETIME(3)` is fine (5.6.4+). Prisma `provider = "mysql"`; pick a Prisma version that still supports 5.7.
- Local default DB URL: `mysql://...@127.0.0.1:3306/...` using that 5.7 server.
- Session cookie auth + bcrypt (SPEC §8.0)
- **JSON file** for program settings per environment (not MySQL)
- Expire job: 1-minute cron (in-process `node-cron` on the web process is OK for this size; document it)

Same git repo. Prod and staging use **different databases** and **different settings files**. They may share **one** MySQL *server*.

## Where it runs (Cloudera AI Workbench)

Deploy as **two Cloudera AI Workbench Applications** (long-running web apps). Not Cloudera AI Inference (that is for models).

| Piece | Where |
|-------|--------|
| Next.js app × 2 public URLs | Two Applications, each with its own subdomain. Start script: `scripts/cloudera-start.py` → binds `127.0.0.1:$CDSW_APP_PORT` |
| Program settings JSON | Instance filesystem: `.data/production/program-settings.json` and `.data/staging/program-settings.json` |
| MySQL | **One** MySQL server the engines can reach, **two databases** (`points_prod`, `points_staging`). Workbench does not provide MySQL. |

**Required layout:**

- Two Application engines, two `APP_PUBLIC_URL`s, two `DATABASE_URL`s, two settings files, two `SESSION_SECRET`s
- Do **not** run one Next.js process with a toggle
- If both Applications share one Cloudera project, they share the filesystem — keep the per-`APP_ENV` settings paths (or set distinct `SETTINGS_FILE`s)

## Program settings (JSON file)

**Source of truth:** one JSON file per environment on that instance. Settings UI reads/writes this file. Cache in memory with short TTL if you want; do not persist program settings as the source of truth in MySQL.

Local: `.data/local/program-settings.json` (never use prod/staging files on the laptop)
Prod: `.data/production/program-settings.json`
Staging: `.data/staging/program-settings.json`

Override with `SETTINGS_FILE` if needed.

Schema (seed this if the file is missing):

```json
{
  "schemaVersion": 1,
  "expiration": {
    "interval": "1_year",
    "timezone": "Asia/Manila"
  },
  "tiers": {
    "lookbackPeriod": "1_year",
    "rules": [
      { "name": "Bronze", "minPoints": 0, "isBase": true },
      { "name": "Silver", "minPoints": 250, "isBase": false },
      { "name": "Gold", "minPoints": 501, "isBase": false },
      { "name": "Platinum", "minPoints": 1000, "isBase": false }
    ]
  }
}
```

`interval` / `lookbackPeriod`: `6_months` | `1_year` (lookback also allows `3_months`). Saving Settings validates SPEC §7.8 then writes the file. Changing interval does **not** rewrite existing lots.

## Public metadata contract (required)

`GET /api/meta` — **no auth**, `Cache-Control: no-store`, CORS `*` (GET only). Same shape on prod and staging:

```json
{
  "app": "points-engine",
  "environment": "production",
  "version": "1.0.0",
  "gitTag": "v1.0.0",
  "gitSha": "abc1234",
  "deployedAt": "2026-08-26T13:00:00.000Z",
  "publicUrl": "https://points-prod.example.com",
  "settingsSource": "file://.data/production/program-settings.json",
  "settings": { }
}
```

- `environment`: `production` | `staging` from `APP_ENV`
- `version` / `gitTag` / `gitSha`: injected at **build/deploy** (`APP_VERSION`, `GIT_TAG`, `GIT_SHA`). If unset, still return the fields as `null`. The Cloudera start script fills SHA/tag from git when possible.
- `settings`: **exact** JSON currently used by the app (not a different schema)
- `publicUrl`: `APP_PUBLIC_URL` (the URL humans and ClouderaAI should use)

Optional extra (nice for robots, keep it tiny): `GET /api/meta/health` → `{ "ok": true, "environment": "staging" }`.

Seed **deterministic demo data on staging only** (flag `SEED_DEMO_DATA=true`): member Elena Cruz plus the SPEC sample earns/redeem so staging is robot-friendly. Production: seed **only** the superadmin, no demo members.

## UX you must not regress (easy to get wrong)

- Members list: **names only**, clickable. No phone, points, or tier on the list.
- Contact number: **Profile only**, never in member chrome/history.
- Available points **under the member name**, not top-right.
- Under available: all-time **Earned / Redeemed / Expired** with `earned − redeemed − expired = available`. Independent of the history date filter (default last 3 months).
- No sign-up. Login only. Admins page creates staff and sets **admin** passwords. **Never** Set password on a superadmin (UI + API 403).
- Settings: own password (current + new) separate from program Save (which writes this env’s JSON file).

## Env vars (both instances)

```
APP_ENV=production|staging
APP_PUBLIC_URL=https://...
APP_VERSION=
GIT_TAG=
GIT_SHA=
DATABASE_URL=
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
SESSION_SECRET=
SETTINGS_FILE=
SEED_DEMO_DATA=false
```

## Deploy

1. Implement locally against **this Mac’s MySQL 5.7.40**.
2. Create **one** MySQL server (5.7 preferred, 8.0 OK if SQL stays 5.7-safe) with databases `points_prod` and `points_staging`.
3. Create **two** Cloudera AI Applications from this repo (`scripts/cloudera-start.py`), each with its own subdomain, env, database, and settings file.
4. Set `GIT_TAG` / `GIT_SHA` / `APP_VERSION` from the git tag you deploy (tag prod, e.g. `v1.0.0`; staging may be the same commit or a later one — **meta must tell the truth**).
5. Verify in a browser (not just screenshots): login, create member, Create Activity, redeem, settings save (JSON file updates), `/api/meta` JSON in an incognito tab with no cookie.
6. Put the two public URLs in `README.md`.

## Done when

- [ ] Prod URL and staging URL load over HTTPS on the public internet
- [ ] `curl -sS $PROD_URL/api/meta` returns version/tag + `settings` matching the prod file, `environment: production`
- [ ] `curl -sS $STAGING_URL/api/meta` returns `environment: staging` and staging’s settings
- [ ] Saving Settings in the UI updates that env’s JSON file and the next `/api/meta` read
- [ ] SPEC flows work: auth, members, history default 3m, profile, tiers, expiration at **next local 00:00 after anniversary date**, FEFO redeem, superadmin password never reset from Admins
- [ ] README: URLs, env vars, how to bump `GIT_TAG` on deploy, settings file layout

Keep the UI simple. Do not add the Chrome extension or Robot generation.
