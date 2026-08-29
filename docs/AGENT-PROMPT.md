# Implementation prompt — Points Engine (prod + staging)

Copy everything below the line into the other agent.

---

## Mission

Build and **deploy two public internet instances** of the same admin loyalty web app from this repo:

1. **Production** — treat as the live system.
2. **Staging** — same app, separate database and S3 settings. This is the environment a later AI job will hit with Robot Framework (`.robot`) to reproduce bugs.

**Product behavior:** follow [`docs/SPEC.md`](docs/SPEC.md) exactly. Program settings are AWS S3 JSON (§8.9). Public `GET /api/meta` is §10.1. Q33: never reset a superadmin password from Admins.

## Do not build

- Chrome extension
- Jira integration
- ClouderaAI / “Reproduce with AI” UI
- `.robot` files or a test runner that talks to Jira

Those will consume **this** app later. Your job is to make prod/staging look like a real program and expose **one simple JSON URL** so another system can read version + settings without AWS credentials.

## Why `/api/meta` exists

A Jira ticket will include the **production URL**. An external agent will `GET {productionUrl}/api/meta` (no auth) and use:

- which **git tag / version** is in production
- the current **program settings JSON** (same payload as S3)

It will then drive **staging** (`APP_PUBLIC_URL` of the staging instance). Plan for that with a stable, CORS-open, unauthenticated metadata route. Do not make ClouderaAI call S3 directly.

## Stack

- Next.js (App Router) + TypeScript + Prisma
- **MySQL 5.7.40** — this is what is installed on the author’s Mac (`mysql Ver 14.14 Distrib 5.7.40`, Homebrew `mysql@5.7` at `/usr/local/opt/mysql@5.7`). Develop and migrate against that. **Do not use MySQL 8-only SQL** (no CTEs, window functions, `CHECK` constraints, `utf8mb4_0900_*` collations, or `RETURNING`). `DATETIME(3)` is fine (5.6.4+). Prisma `provider = "mysql"`; pick a Prisma version that still supports 5.7.
- Local default DB URL: `mysql://...@127.0.0.1:3306/...` using that 5.7 server.
- Session cookie auth + bcrypt (SPEC §8.0)
- **AWS S3** object for program settings JSON per environment
- Expire job: 1-minute cron (in-process `node-cron` on the web process is OK for this size; document it)

Same git repo. Prod and staging use **different databases** (and different S3 keys). They may share **one** MySQL *server*.

## Where it runs (AWS, and what is actually “free”)

Yes — plan this on **AWS**, with S3 + RDS + a small compute box. It is **not** all always-free, and **two separate RDS instances would leave free tier**.

| Piece | Where | Free-tier reality |
|-------|--------|-------------------|
| Program settings JSON | **S3** one bucket, two keys (`production/program-settings.json`, `staging/program-settings.json`) | A few KB. Well within S3 free-tier / leftover credits. Keep it. |
| MySQL | **One** RDS instance, **MySQL 5.7 if the region still offers it; otherwise RDS MySQL 8.0** with the same 5.7-safe schema | Traditional free tier (accounts before ~15 Jul 2025): **750 hours/month of one `db.t3.micro` (or t2/t4g micro), single-AZ**, 20 GB. Hours **add across instances** — two RDS boxes 24/7 **will bill**. Newer accounts may get credits instead of a hard 750h allowance — check the account. |
| App (Next.js) × 2 public URLs | **One** EC2 `t3.micro` (or Elastic Beanstalk single-instance) + nginx: `prod.` and `staging.` → two Node processes **or** two containers on that host | Same idea: **750 hours/month of one micro**. A second EC2 24/7 bills. 1 GB RAM is tight for two Next apps — keep the UI simple; if it OOMs, run **prod on EC2** and **staging as a second process only during the hackathon**, or one Next app with `APP_ENV` is **not** allowed (must be two URLs / two processes). |

**Required layout so we stay on one DB server:**

- RDS databases: `points_prod` and `points_staging` (two schemas, one instance)
- Two app processes, two `APP_PUBLIC_URL`s, two `DATABASE_URL`s, two `SETTINGS_S3_KEY`s
- Do **not** provision two RDS instances

If RDS 5.7 is unavailable for a new instance, use **RDS 8.0** in the cloud but keep all SQL **5.7-compatible** so the Mac 5.7.40 app still runs. Do not upgrade the Mac to 8 to “match RDS” unless the human asks.

If the AWS account is out of free tier / credits, stop and say so in the README with a cost estimate before creating paid resources. Do not silently create a second RDS.

## Program settings (S3 JSON)

**Source of truth:** S3. Settings UI reads/writes this file. Cache in memory with short TTL if you want; do not persist program settings as the source of truth in MySQL.

Object key (example): `s3://$AWS_S3_BUCKET/$SETTINGS_S3_KEY`  
Local: `local/program-settings.json` (same S3 API; never use prod/staging keys on the laptop)  
Prod key: `production/program-settings.json`  
Staging key: `staging/program-settings.json`

Schema (seed this if the object is missing):

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

`interval` / `lookbackPeriod`: `6_months` | `1_year` (lookback also allows `3_months`). Saving Settings validates SPEC §7.8 then `PutObject`. Changing interval does **not** rewrite existing lots.

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
  "publicUrl": "https://points-engine-prod.example.com",
  "settingsSource": "s3://your-bucket/production/program-settings.json",
  "settings": { }
}
```

- `environment`: `production` | `staging` from `APP_ENV`
- `version` / `gitTag` / `gitSha`: injected at **build/deploy** (`APP_VERSION`, `GIT_TAG`, `GIT_SHA`). If unset, still return the fields as `null` and document how to set them (e.g. Railway `RAILWAY_GIT_COMMIT_SHA`).
- `settings`: **exact** S3 JSON currently used by the app (not a different schema)
- `publicUrl`: `APP_PUBLIC_URL` (the URL humans and ClouderaAI should use)

Optional extra (nice for robots, keep it tiny): `GET /api/meta/health` → `{ "ok": true, "environment": "staging" }`.

Seed **deterministic demo data on staging only** (flag `SEED_DEMO_DATA=true`): member Elena Cruz plus the SPEC sample earns/redeem so staging is robot-friendly. Production: seed **only** the superadmin, no demo members.

## UX you must not regress (easy to get wrong)

- Members list: **names only**, clickable. No phone, points, or tier on the list.
- Contact number: **Profile only**, never in member chrome/history.
- Available points **under the member name**, not top-right.
- Under available: all-time **Earned / Redeemed / Expired** with `earned − redeemed − expired = available`. Independent of the history date filter (default last 3 months).
- No sign-up. Login only. Admins page creates staff and sets **admin** passwords. **Never** Set password on a superadmin (UI + API 403).
- Settings: own password (current + new) separate from program Save (which writes S3).

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
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
SETTINGS_S3_KEY=production/program-settings.json
SEED_DEMO_DATA=false
```

## Deploy

1. Implement locally against **this Mac’s MySQL 5.7.40** + real S3 (or MinIO only as a last resort; shipped path is S3).
2. Create **one** RDS MySQL (5.7 preferred, 8.0 OK if 5.7 isn’t offered) with databases `points_prod` and `points_staging`.
3. Create **one** EC2/Elastic Beanstalk micro and run **two** app processes (prod + staging) with nginx (or equivalent) so both have public HTTPS URLs. One bucket, two settings keys.
4. Set `GIT_TAG` / `GIT_SHA` / `APP_VERSION` from the git tag you deploy (tag prod, e.g. `v1.0.0`; staging may be the same commit or a later one — **meta must tell the truth**).
5. Verify in a browser (not just screenshots): login, create member, Create Activity, redeem, settings save (S3 object updates), `/api/meta` JSON in an incognito tab with no cookie.
6. Put the two public URLs in `README.md`. Note RDS engine version vs local 5.7.40.

## Done when

- [ ] Prod URL and staging URL load over HTTPS on the public internet
- [ ] `curl -sS $PROD_URL/api/meta` returns version/tag + `settings` matching S3, `environment: production`
- [ ] `curl -sS $STAGING_URL/api/meta` returns `environment: staging` and staging’s settings
- [ ] Saving Settings in the UI updates that env’s S3 JSON and the next `/api/meta` read
- [ ] SPEC flows work: auth, members, history default 3m, profile, tiers, expiration at **next local 00:00 after anniversary date**, FEFO redeem, superadmin password never reset from Admins
- [ ] README: URLs, env vars, how to bump `GIT_TAG` on deploy, S3 key layout

Keep the UI simple. Do not add the Chrome extension or Robot generation.
