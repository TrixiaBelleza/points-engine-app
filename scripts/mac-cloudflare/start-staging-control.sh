#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cd "${ROOT}"

token_file="${DEPLOY}/staging-control.env"
if [[ ! -f "${token_file}" ]]; then
  echo "Missing ${token_file}." >&2
  echo "Copy deploy/mac-cloudflare/staging-control.env.example and set STAGING_CONTROL_TOKEN." >&2
  echo "Or run: bash scripts/mac-cloudflare/setup.sh" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${token_file}"
set +a

if [[ -z "${STAGING_CONTROL_TOKEN:-}" ]]; then
  echo "STAGING_CONTROL_TOKEN is not set in ${token_file}." >&2
  exit 1
fi

echo "Starting staging-control on 127.0.0.1:3100"
exec npx tsx staging-control/server.ts
