#!/usr/bin/env bash
# Quick tunnel. Hostname changes every restart.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_cloudflared

name="${1:-}"
if [[ "${name}" != "prod" && "${name}" != "staging" && "${name}" != "control" ]]; then
  echo "Usage: $0 prod|staging|control" >&2
  exit 1
fi

if [[ "${name}" == "control" ]]; then
  port=3100
  echo "Tunneling https → http://127.0.0.1:${port} (staging-control)"
  echo "Give the trycloudflare.com URL and STAGING_CONTROL_TOKEN to the Environment Setup Agent."
  echo "Do not put this URL in APP_PUBLIC_URL."
else
  load_instance_env "${name}"
  port="${PORT}"
  echo "Tunneling https → http://127.0.0.1:${port}"
  echo "Copy the trycloudflare.com URL into APP_PUBLIC_URL in deploy/mac-cloudflare/${name}.env"
  echo "then restart the matching start-${name}.sh process."
fi
echo
exec cloudflared tunnel --url "http://127.0.0.1:${port}"
