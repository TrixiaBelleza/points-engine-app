#!/usr/bin/env bash
# Helpers for the Ready, Set, Repro! GitHub Actions Robot runner.
# Suites expect APP_PUBLIC_URL (see tests/robot/resources/common.resource).
set -euo pipefail

usage() {
  echo "Usage: robot-repro.sh <select-pr|select-dispatch|run|collect>" >&2
  exit 2
}

repo_root() {
  cd "$(dirname "$0")/../.."
  pwd
}

require_repo_relative_robot() {
  local path="$1"
  if [[ -z "${path}" ]]; then
    echo "Robot path is empty." >&2
    exit 1
  fi
  if [[ "${path}" == -* ]]; then
    echo "Robot path must be a file, not a command flag." >&2
    exit 1
  fi
  if [[ "${path}" == /* ]]; then
    echo "Robot path must be repository-relative, not absolute." >&2
    exit 1
  fi
  if [[ "${path}" == *..* ]]; then
    echo "Robot path must not contain '..'." >&2
    exit 1
  fi
  if [[ "${path}" != *.robot ]]; then
    echo "Only .robot files can be run (got: ${path})." >&2
    exit 1
  fi
}

write_list() {
  local out="$1"
  shift
  : > "${out}"
  local path
  for path in "$@"; do
    require_repo_relative_robot "${path}"
    if [[ ! -f "${path}" ]]; then
      echo "Robot file not found: ${path}" >&2
      exit 1
    fi
    printf '%s\n' "${path}" >> "${out}"
  done
}

cmd_select_pr() {
  local base_sha="${BASE_SHA:?BASE_SHA is required}"
  local head_sha="${HEAD_SHA:?HEAD_SHA is required}"
  local base_ref="${BASE_REF:-main}"
  local out="${ROBOT_FILE_LIST:?ROBOT_FILE_LIST is required}"

  if ! git cat-file -e "${base_sha}^{commit}" 2>/dev/null; then
    git fetch --no-tags origin "${base_sha}" \
      || git fetch --no-tags origin "${base_ref}"
  fi

  local files=()
  local line
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    files+=("${line}")
  done < <(git diff --name-only --diff-filter=ACMR "${base_sha}...${head_sha}" -- '*.robot')

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No changed .robot file was found in this pull request." >&2
    echo "Ready, Set, Repro! PRs must add or update at least one generated Robot test." >&2
    echo "Compared ${base_sha}...${head_sha}." >&2
    exit 1
  fi

  echo "Changed Robot tests:"
  printf '  %s\n' "${files[@]}"
  write_list "${out}" "${files[@]}"
}

cmd_select_dispatch() {
  local path="${TEST_PATH:?TEST_PATH is required}"
  local out="${ROBOT_FILE_LIST:?ROBOT_FILE_LIST is required}"
  require_repo_relative_robot "${path}"
  if [[ ! -f "${path}" ]]; then
    echo "workflow_dispatch test_path does not exist: ${path}" >&2
    exit 1
  fi
  echo "Manual Robot test: ${path}"
  write_list "${out}" "${path}"
}

cmd_run() {
  local list="${ROBOT_FILE_LIST:?ROBOT_FILE_LIST is required}"
  local results="${ROBOT_RESULTS_DIR:-tests/robot/results}"

  if [[ -z "${APP_PUBLIC_URL:-}" ]]; then
    echo "APP_PUBLIC_URL is not set." >&2
    echo "Map GitHub STAGING_BASE_URL to APP_PUBLIC_URL before running Robot." >&2
    exit 1
  fi

  if [[ ! -s "${list}" ]]; then
    echo "Robot file list is missing or empty: ${list}" >&2
    exit 1
  fi

  local files=()
  local path
  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    require_repo_relative_robot "${path}"
    if [[ ! -f "${path}" ]]; then
      echo "Robot file not found: ${path}" >&2
      exit 1
    fi
    files+=("${path}")
  done < "${list}"

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No Robot files to run." >&2
    exit 1
  fi

  mkdir -p "${results}"
  export ROBOT_HEADLESS="${ROBOT_HEADLESS:-true}"

  # Generated suites should not inherit GitHub tokens or cloud credentials.
  unset GITHUB_TOKEN ACTIONS_RUNTIME_TOKEN ACTIONS_ID_TOKEN_REQUEST_TOKEN ACTIONS_ID_TOKEN_REQUEST_URL || true
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN || true

  echo "Running Robot Framework against Staging (APP_PUBLIC_URL is set, value not printed)."
  echo "Files:"
  printf '  %s\n' "${files[@]}"

  python3 -m robot \
    --outputdir "${results}" \
    --output output.xml \
    --log log.html \
    --report report.html \
    --pythonpath tests/robot \
    --pythonpath tests/robot/libraries \
    --pythonpath tests/robot/resources \
    "${files[@]}"
}

cmd_collect() {
  local results="${ROBOT_RESULTS_DIR:-tests/robot/results}"
  mkdir -p "${results}"

  shopt -s nullglob
  local extra=(
    log.html
    report.html
    output.xml
    selenium-screenshot-*.png
    selenium-video-*.webm
  )
  local f
  for f in "${extra[@]}"; do
    if [[ -f "${f}" && ! -e "${results}/$(basename "${f}")" ]]; then
      mv "${f}" "${results}/" || true
    fi
  done

  # Playwright/Browser traces if a generated suite uses them.
  local found
  while IFS= read -r -d '' found; do
    local dest="${results}/$(basename "${found}")"
    if [[ ! -e "${dest}" ]]; then
      mv "${found}" "${dest}" || true
    fi
  done < <(find . -maxdepth 3 \( \
      -name 'trace.zip' -o \
      -name 'playwright-log.txt' -o \
      -name '*.webm' \
    \) ! -path "./tests/robot/results/*" ! -path "./.git/*" ! -path "./node_modules/*" -print0 2>/dev/null || true)
}

main() {
  cd "$(repo_root)"
  local cmd="${1:-}"
  case "${cmd}" in
    select-pr) cmd_select_pr ;;
    select-dispatch) cmd_select_dispatch ;;
    run) cmd_run ;;
    collect) cmd_collect ;;
    *) usage ;;
  esac
}

main "${1:-}"
