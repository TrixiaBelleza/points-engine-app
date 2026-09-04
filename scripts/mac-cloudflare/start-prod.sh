#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cd "${ROOT}"
load_instance_env prod
echo "Starting production on ${HOST:-127.0.0.1}:${PORT:-3000} (APP_ENV=${APP_ENV})"
exec npx next start -H "${HOST:-127.0.0.1}" -p "${PORT:-3000}"
