#!/usr/bin/env bash
# Cloudera AI Workbench Application entrypoint.
# Binds Next.js to 127.0.0.1:$CDSW_APP_PORT so the Workbench proxy can reach it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${CDSW_APP_PORT:-${CDSW_READONLY_PORT:-${PORT:-3000}}}"
HOST="${HOST:-127.0.0.1}"
NODE_VERSION="${NODE_VERSION:-20.18.3}"
RUNTIME_DIR="${ROOT}/.runtime"

node_ok() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 || return 1
  local major
  major="$(node -p "parseInt(process.versions.node, 10)")"
  [[ "${major}" -ge 18 ]]
}

ensure_node() {
  if node_ok; then
    return 0
  fi

  local os arch dest tarball url
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *)
      echo "Unsupported CPU architecture: ${arch}" >&2
      exit 1
      ;;
  esac
  case "${os}" in
    linux | darwin) ;;
    *)
      echo "Unsupported OS: ${os}" >&2
      exit 1
      ;;
  esac

  dest="${RUNTIME_DIR}/node-v${NODE_VERSION}-${os}-${arch}"
  mkdir -p "${RUNTIME_DIR}"
  if [[ ! -x "${dest}/bin/node" ]]; then
    tarball="node-v${NODE_VERSION}-${os}-${arch}.tar.xz"
    url="https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
    echo "Node >= 18 not found; downloading ${url}"
    curl -fsSL "${url}" -o "${RUNTIME_DIR}/${tarball}"
    tar -xJf "${RUNTIME_DIR}/${tarball}" -C "${RUNTIME_DIR}"
    rm -f "${RUNTIME_DIR}/${tarball}"
  fi
  export PATH="${dest}/bin:${PATH}"
}

ensure_node

if [[ ! -d node_modules ]]; then
  npm ci
fi

if [[ "${DATABASE_URL:-}" == file:* ]]; then
  db_path="${DATABASE_URL#file:}"
  db_path="${db_path%%\?*}"
  if [[ "${db_path}" != /* ]]; then
    # Prisma resolves relative SQLite URLs from the schema directory.
    db_path="${ROOT}/prisma/${db_path}"
  fi
  mkdir -p "$(dirname "${db_path}")"
fi

npx prisma generate

if [[ "${DATABASE_URL:-}" == file:* ]] || [[ "${PRISMA_DB_PUSH:-}" == "true" ]]; then
  npx prisma db push
fi

if [[ ! -d .next ]] || [[ "${NEXT_REBUILD:-}" == "true" ]]; then
  npm run build
fi

if command -v git >/dev/null 2>&1; then
  if [[ -z "${GIT_SHA:-}" ]]; then
    GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
    export GIT_SHA
  fi
  if [[ -z "${GIT_TAG:-}" ]]; then
    GIT_TAG="$(git describe --tags --exact-match 2>/dev/null || true)"
    export GIT_TAG
  fi
fi
if [[ -z "${DEPLOYED_AT:-}" ]]; then
  DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
  export DEPLOYED_AT
fi

echo "Starting Points Engine on ${HOST}:${PORT} (APP_ENV=${APP_ENV:-unset})"
exec npx next start -H "${HOST}" -p "${PORT}"
