# Points Engine — Admin Loyalty App

Staff-only loyalty program: create members, log activities that award points, redeem, and see when remaining points expire. Members do not log in.

Behavior follows [`docs/SPEC.md`](docs/SPEC.md). Program settings (expiration interval, timezone, tier rules) live in **AWS S3 JSON**, not MySQL. `GET /api/meta` is public so other systems can read version + settings without AWS credentials.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + **MySQL 5.7.40** locally (Homebrew `mysql@5.7`)
- Session cookie + bcrypt
- AWS S3 (`GetObject` / `PutObject`) for program settings
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
# Optional: AWS_S3_BUCKET + keys. Local key must be local/program-settings.json
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.

If `SEED_DEMO_DATA=true`, Elena Cruz and Juan Dela Cruz are created with sample ledger rows.

### Program settings (S3)

| Env | `APP_ENV` | `SETTINGS_S3_KEY` |
|-----|-----------|-------------------|
| Laptop | `development` | `local/program-settings.json` |
| Production | `production` | `production/program-settings.json` |
| Staging | `staging` | `staging/program-settings.json` |

Localhost uses the same S3 SDK as prod. **Never** point the laptop at `production/` or `staging/` keys.

If `AWS_S3_BUCKET` is unset or PutObject fails, the app writes `.data/program-settings.json` as a last resort (same JSON schema) and `/api/meta` reports that source honestly.

### Public metadata

```bash
curl -sS http://localhost:3000/api/meta
curl -sS http://localhost:3000/api/meta/health
```

No cookie. `Cache-Control: no-store`. CORS `GET` from `*`.

`version` / `gitTag` / `gitSha` come from `APP_VERSION`, `GIT_TAG`, `GIT_SHA` at deploy. If unset, those fields are JSON `null`.

## Env vars

See `.env.example`. Both production and staging need their own `DATABASE_URL`, `APP_PUBLIC_URL`, and `SETTINGS_S3_KEY`.

| Variable | Notes |
|----------|--------|
| `APP_ENV` | `development` \| `staging` \| `production` |
| `APP_PUBLIC_URL` | Canonical URL for this instance |
| `DATABASE_URL` | MySQL 5.7-compatible URL |
| `SESSION_SECRET` | Cookie signing key |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Seeded only when `admins` is empty; unset the password after first deploy |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` | S3 |
| `SETTINGS_S3_KEY` | Object key for this environment |
| `AWS_S3_ENDPOINT` | Optional MinIO endpoint |
| `SEED_DEMO_DATA` | `true` only for local/staging |
| `APP_VERSION` / `GIT_TAG` / `GIT_SHA` / `DEPLOYED_AT` | Injected at deploy |

## Expire job

`expire-lots` runs every minute inside the Next.js Node process (`lib/expire-job.ts`, started on boot). Balance truth never waits on the job: lots with `expires_at <= now` are not spendable even before the `EXPIRE` row is written.

## Deploy (prod + staging)

Same git repo, **two processes**, two public URLs, two databases, two S3 keys. Use **one** RDS instance with databases `points_prod` and `points_staging` (two RDS boxes 24/7 leave free tier). Do not run two Next.js apps on a single 1 GB `t3.micro` if it OOMs — prefer two small web services (Render/Railway) talking to that RDS, or one EC2 with nginx only if memory allows.

1. Create the two databases and run `npx prisma db push` (or `prisma migrate deploy` once a migration is applied) against each.
2. Create one S3 bucket; put `production/program-settings.json` and `staging/program-settings.json`.
3. Set `GIT_TAG` / `GIT_SHA` / `APP_VERSION` from the git tag you deploy (e.g. `v1.0.0`). Meta must tell the truth.
4. Production: `SEED_DEMO_DATA=false` (superadmin only). Staging may set `SEED_DEMO_DATA=true`.
5. Verify in a browser: login, create member, Create Activity, redeem, Save settings (S3 object updates). Then `curl -sS $APP_PUBLIC_URL/api/meta` in a session with **no cookie**.

Public URLs (fill in after deploy):

- Production: _(not deployed from this machine yet)_
- Staging: _(not deployed from this machine yet)_

RDS in AWS may be MySQL 8.0 if 5.7 is no longer offered; keep SQL 5.7-safe. Local remains 5.7.40.

## Tests

```bash
npm test
```

Covers expiration timestamps (end of anniversary day), MySQL `DATE_ADD` clipping, PH phones, and seeded tier thresholds.
