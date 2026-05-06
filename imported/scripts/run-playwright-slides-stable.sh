#!/usr/bin/env bash
set -euo pipefail

PORT="${PLAYWRIGHT_WEB_SERVER_PORT:-3003}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:${PORT}}"
BUILD_LOG_FILE="${TMPDIR:-/tmp}/oliver-slides-playwright-build.log"
SERVER_LOG_FILE="${TMPDIR:-/tmp}/oliver-slides-playwright-next.log"
REPEAT_COUNT="${SLIDES_STABLE_REPEAT_COUNT:-1}"
SERVER_WAIT_SECONDS="${SLIDES_STABLE_SERVER_WAIT_SECONDS:-30}"
LIST_ONLY=0
DEFAULT_SUITES=(
  "tests/e2e/slides-regression.spec.ts"
  "tests/e2e/slides-visual.spec.ts"
)

for arg in "$@"; do
  if [[ "${arg}" == "--list" ]]; then
    LIST_ONLY=1
  fi
done

if [[ "${LIST_ONLY}" == "1" ]]; then
  echo "[slides-stable] default suites:"
  for suite in "${DEFAULT_SUITES[@]}"; do
    echo "- ${suite}"
  done
  echo "[slides-stable] required env:"
  echo "- NEXT_PUBLIC_SUPABASE_URL"
  echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "[slides-stable] configurable env:"
  echo "- PLAYWRIGHT_WEB_SERVER_PORT (default: 3003)"
  echo "- SLIDES_STABLE_REPEAT_COUNT (default: 1)"
  echo "- SLIDES_STABLE_SERVER_WAIT_SECONDS (default: 30)"
  exit 0
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

require_command() {
  local command_name="$1"
  if command -v "${command_name}" >/dev/null 2>&1; then
    return
  fi
  echo "[slides-stable][preflight] missing required command: ${command_name}" >&2
  exit 1
}

require_non_empty_env() {
  local env_name="$1"
  local env_value="${!env_name:-}"
  if [[ -n "${env_value}" ]]; then
    return
  fi
  echo "[slides-stable][preflight] missing required env: ${env_name}" >&2
  echo "[slides-stable][preflight] set ${env_name} before running this harness." >&2
  exit 1
}

echo "[slides-stable][preflight] starting harness checks for ${BASE_URL}" >&2
require_command npm
require_command npx
require_command curl
require_command python3
require_non_empty_env NEXT_PUBLIC_SUPABASE_URL
require_non_empty_env NEXT_PUBLIC_SUPABASE_ANON_KEY
echo "[slides-stable][preflight] dependency and env checks passed." >&2

NEXT_PUBLIC_E2E_AUTH_BYPASS=1 npm run build >"${BUILD_LOG_FILE}" 2>&1 || {
  echo "[slides-stable][preflight] build failed." >&2
  tail -n 200 "${BUILD_LOG_FILE}" >&2 || true
  exit 1
}

if [[ ! -f "out/index.html" ]]; then
  echo "[slides-stable][preflight] build output missing: out/index.html" >&2
  tail -n 200 "${BUILD_LOG_FILE}" >&2 || true
  exit 1
fi

echo "[slides-stable][preflight] build completed. launching static server on port ${PORT}." >&2
nohup python3 -m http.server "${PORT}" --directory out >"${SERVER_LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 "${SERVER_WAIT_SECONDS}"); do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "[slides-stable][preflight] static server exited before readiness check completed." >&2
    tail -n 200 "${SERVER_LOG_FILE}" >&2 || true
    exit 1
  fi

  if curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
    TEST_ARGS=("${DEFAULT_SUITES[@]}")
    if [[ "$#" -gt 0 ]]; then
      TEST_ARGS+=("$@")
    fi

    echo "[slides-stable] suites: ${TEST_ARGS[*]}" >&2
    for run in $(seq 1 "${REPEAT_COUNT}"); do
      echo "[slides-stable] run ${run}/${REPEAT_COUNT} on ${BASE_URL}" >&2
      PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL="${BASE_URL}" npx playwright test "${TEST_ARGS[@]}" || {
        echo "[slides-stable] failed run ${run}/${REPEAT_COUNT}." >&2
        tail -n 200 "${SERVER_LOG_FILE}" >&2 || true
        exit 1
      }
    done
    echo "[slides-stable] completed ${REPEAT_COUNT} run(s) successfully." >&2
    exit 0
  fi
  sleep 1
done

echo "[slides-stable][preflight] timed out waiting for ${BASE_URL} after ${SERVER_WAIT_SECONDS}s." >&2
tail -n 200 "${BUILD_LOG_FILE}" >&2 || true
tail -n 200 "${SERVER_LOG_FILE}" >&2 || true
exit 1
