#!/usr/bin/env bash
# validate.sh — Canonical validation for Slides Editor
# Runs: pre-commit gates (secrets, .env, privacy, credentials)
# Exits non-zero on failure.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Slides Editor Validation ==="
echo ""

# Run pre-commit hook (it validates staged content)
if [ -x ".githooks/pre-commit" ]; then
  echo "[1] Pre-commit gates..."
  if bash .githooks/pre-commit; then
    echo "  PASS"
  else
    echo "  FAIL"
    exit 1
  fi
else
  echo "[1] Pre-commit gates: .githooks/pre-commit not found"
  exit 1
fi

echo ""
echo "All checks passed."
exit 0
