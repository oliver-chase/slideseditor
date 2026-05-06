#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROFILE="local-runtime"
MODE="repo-local"
RUN_VALIDATE=0

usage() {
  cat <<EOF
Usage: $0 [--profile repo-contract-only|local-runtime|private-overlay] [--mode repo-local|vault-integrated] [--validate]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --validate) RUN_VALIDATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "FAIL unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$PROFILE" in
  repo-contract-only|local-runtime|private-overlay) ;;
  *) echo "FAIL invalid profile: $PROFILE" >&2; exit 1 ;;
esac

case "$MODE" in
  repo-local|vault-integrated) ;;
  *) echo "FAIL invalid mode: $MODE" >&2; exit 1 ;;
esac

mkdir -p "$REPO_ROOT/.secrets"

if [[ ! -f "$REPO_ROOT/.env.example" ]]; then
  cat > "$REPO_ROOT/.env.example" <<'EOF'
# Placeholder-only tracked env template.
# Copy values you actually use into .env.local only.
EOF
fi

if [[ "$PROFILE" == "local-runtime" || "$PROFILE" == "private-overlay" ]]; then
  if [[ ! -f "$REPO_ROOT/.env.local" ]]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env.local"
    chmod 600 "$REPO_ROOT/.env.local" || true
    echo "created $REPO_ROOT/.env.local from .env.example"
  else
    echo "found $REPO_ROOT/.env.local"
  fi
fi

if [[ "$RUN_VALIDATE" -eq 1 ]]; then
  bash "$REPO_ROOT/scripts/run-profile-checks.sh" --profile "$PROFILE" --mode "$MODE"
else
  echo "bootstrap complete: profile=$PROFILE mode=$MODE"
fi
