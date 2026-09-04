# Mac + Cloudflare Tunnel (prod + staging)

Your laptop runs both apps. Cloudflare only publishes HTTPS URLs for you and for an agent.

Leave the Mac **awake and plugged in** while tunnels are up (`System Settings → Battery → Prevent automatic sleeping when the display is off`, or `caffeinate` in a spare terminal).

## One-time

```bash
bash scripts/mac-cloudflare/setup.sh
npm run build
```

`setup.sh` creates `points_prod` and `points_staging`, writes `deploy/mac-cloudflare/prod.env`, `staging.env`, and `staging-control.env` (all gitignored), and seeds each database. Staging gets demo members; production does not. Cancel earn/redeem are **on** in prod and **off** in staging.

Your existing local app (`points_engine`, `npm run dev`) is unchanged.

## Every demo

Six terminals (or six tabs):

```bash
bash scripts/mac-cloudflare/start-prod.sh
bash scripts/mac-cloudflare/start-staging.sh
bash scripts/mac-cloudflare/start-staging-control.sh
bash scripts/mac-cloudflare/tunnel.sh prod
bash scripts/mac-cloudflare/tunnel.sh staging
bash scripts/mac-cloudflare/tunnel.sh control
```

Each `cloudflared` log line includes `https://….trycloudflare.com`. For **prod** and **staging**, put that URL in `APP_PUBLIC_URL` in the matching `.env` and **restart** that `start-*.sh` process so `/api/meta` reports the public URL.

The **control** tunnel publishes `127.0.0.1:3100` only. Give that URL plus `STAGING_CONTROL_TOKEN` (from `deploy/mac-cloudflare/staging-control.env`) to the Environment Setup Agent. Do **not** put the control URL in `APP_PUBLIC_URL`.

Quick-tunnel hostnames **change on every `cloudflared` restart**. Update the agent config to match. The token must stay private: never put it in a URL, commit, README, screenshot, or log.

## Staging Control API

Loopback service: `http://127.0.0.1:3100`. Allow-list: `enable_cancel_earn`, `enable_cancel_redeem`, `expiration_interval`, `timezone`, and `tiers`. Bearer token required on every route. Secrets, database URL, host, and port are not writable.

### Start the control service

```bash
npm run start:staging-control
# same as: bash scripts/mac-cloudflare/start-staging-control.sh
```

The process binds **only** to `127.0.0.1:3100` and reads `STAGING_CONTROL_TOKEN` from gitignored `deploy/mac-cloudflare/staging-control.env`. Copy `staging-control.env.example` and set a long random token if that file is missing (`openssl rand -hex 32`). `setup.sh` can create it once.

### Start a control-only Cloudflare tunnel

Do **not** restart the prod or staging tunnels.

```bash
bash scripts/mac-cloudflare/tunnel.sh control
```

Copy the `https://….trycloudflare.com` hostname from the `cloudflared` log. That hostname **changes after every tunnel restart**. Put the token in the `Authorization: Bearer` header only — never in the URL or query string.

### Test (dry run only until you intend to change Staging)

Load the token into the shell without printing it:

```bash
TOKEN="$(grep '^STAGING_CONTROL_TOKEN=' deploy/mac-cloudflare/staging-control.env | cut -d= -f2-)"
```

Local:

```bash
curl -sS -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:3100/health
curl -sS -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:3100/status
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"manual-dry-run-001","dry_run":true,"changes":{"enable_cancel_earn":true,"expiration_interval":"1_year"}}' \
  http://127.0.0.1:3100/setup
```

Through the control tunnel, use the same paths and bearer header against `https://<control-hostname>` (replace the hostname from the current `cloudflared` log). `dry_run: true` validates the request and returns planned `applied_changes` without writing Staging env/settings files or restarting Staging. Omit `dry_run` (or set it `false`) only when you intend a real Staging change.

## After first staging boot

Open the staging Cloudflare URL → Settings → expiration **6 months** → save. Production stays 12 months.

## Agent

- Prod URL → `GET /api/meta` (no cookie)
- Staging URL → Robot / UI run
- Control URL → Environment Setup Agent (`Authorization: Bearer` + `/setup`)

Sign-in still uses `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from each env file. Unset the password in those files after you change it in the UI.

## Local vs tunnel

| | Local laptop | Demo / agent |
|--|--------------|----------------|
| Prod | `http://127.0.0.1:3000` | Cloudflare HTTPS |
| Staging | `http://127.0.0.1:3001` | Cloudflare HTTPS |
| Staging control | `http://127.0.0.1:3100` | Separate Cloudflare HTTPS + bearer token |

`APP_ENV` is `production` / `staging`, so login cookies are **Secure**. Use the **HTTPS** tunnel URLs in a browser, not `http://127.0.0.1`.
