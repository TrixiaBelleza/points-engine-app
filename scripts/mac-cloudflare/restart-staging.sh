#!/usr/bin/env bash
# Stop whatever is listening on 127.0.0.1:3001, then start Staging only.
# No arguments. Never touches port 3000 / production.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cd "${ROOT}"
load_instance_env staging

if [[ "${APP_ENV}" != "staging" ]]; then
  echo "Refusing to restart: APP_ENV is not staging." >&2
  exit 1
fi
if [[ "${PORT}" != "3001" ]]; then
  echo "Refusing to restart: staging PORT must be 3001." >&2
  exit 1
fi
if [[ "${HOST:-127.0.0.1}" != "127.0.0.1" && "${HOST}" != "localhost" ]]; then
  echo "Refusing to restart: staging HOST must be loopback." >&2
  exit 1
fi

stop_staging() {
  local pids
  pids="$(lsof -nP -iTCP:3001 -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  # shellcheck disable=SC2086
  kill ${pids} 2>/dev/null || true
  for _ in $(seq 1 50); do
    if ! lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  pids="$(lsof -nP -iTCP:3001 -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

stop_staging

mkdir -p "${ROOT}/.runtime"
nohup bash "${ROOT}/scripts/mac-cloudflare/start-staging.sh" >> "${ROOT}/.runtime/staging.log" 2>&1 &
echo $! > "${ROOT}/.runtime/staging.pid"
