ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="${ROOT}/deploy/mac-cloudflare"

load_instance_env() {
  local name="$1"
  local file="${DEPLOY}/${name}.env"
  if [[ ! -f "${file}" ]]; then
    echo "Missing ${file}. Run: bash scripts/mac-cloudflare/setup.sh" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "${file}"
  set +a
}

require_cloudflared() {
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared not found. Install with: brew install cloudflared" >&2
    exit 1
  fi
}
