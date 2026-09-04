#!/usr/bin/env bash
# Create two local MySQL databases and env files for Mac + Cloudflare Tunnel.
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

mkdir -p "${DEPLOY}"

write_env() {
  local name="$1"
  local dest="${DEPLOY}/${name}.env"
  local example="${DEPLOY}/${name}.env.example"
  if [[ -f "${dest}" ]]; then
    echo "Keeping existing ${dest}"
    return 0
  fi
  local secret
  secret="$(openssl rand -hex 32)"
  sed "s/replace-with-openssl-rand-hex-32/${secret}/" "${example}" > "${dest}"
  chmod 600 "${dest}"
  echo "Wrote ${dest}"
}

if ! "${MYSQL}" -h 127.0.0.1 -u root -e "SELECT 1" >/dev/null 2>&1; then
  echo "Cannot connect to MySQL 5.7 at 127.0.0.1 as root." >&2
  echo "Start it with: /usr/local/opt/mysql@5.7/bin/mysql.server start" >&2
  exit 1
fi

"${MYSQL}" -h 127.0.0.1 -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS points_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS points_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL

write_control_env() {
  local dest="${DEPLOY}/staging-control.env"
  local example="${DEPLOY}/staging-control.env.example"
  if [[ -f "${dest}" ]]; then
    echo "Keeping existing ${dest}"
    return 0
  fi
  local token
  token="$(openssl rand -hex 32)"
  sed "s/replace-with-openssl-rand-hex-32/${token}/" "${example}" > "${dest}"
  chmod 600 "${dest}"
  echo "Wrote ${dest}"
}

write_env prod
write_env staging
write_control_env

cd "${ROOT}"
if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "Pushing schema + seeding production (no demo members)..."
set -a && source "${DEPLOY}/prod.env" && set +a
npx prisma db push
npx prisma db seed

echo "Pushing schema + seeding staging (demo members)..."
set -a && source "${DEPLOY}/staging.env" && set +a
npx prisma db push
npx prisma db seed

echo
echo "Done. Next:"
echo "  npm run build"
echo "  bash scripts/mac-cloudflare/start-prod.sh"
echo "  bash scripts/mac-cloudflare/start-staging.sh"
echo "  bash scripts/mac-cloudflare/start-staging-control.sh"
echo "  bash scripts/mac-cloudflare/tunnel.sh prod"
echo "  bash scripts/mac-cloudflare/tunnel.sh staging"
echo "  bash scripts/mac-cloudflare/tunnel.sh control"
echo
echo "After the prod and staging tunnels print https://….trycloudflare.com, paste each URL into"
echo "APP_PUBLIC_URL in the matching deploy/mac-cloudflare/*.env and restart that instance."
echo "The control tunnel URL is for the Environment Setup Agent only — never put it in APP_PUBLIC_URL."
