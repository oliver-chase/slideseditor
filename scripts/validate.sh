#!/usr/bin/env bash
# validate.sh: this repo's canonical validation. Run `bash scripts/validate.sh` before every commit.
# It runs the checks the repo has and skips the rest, so a new repo passes until you add your own.
# Add your tests, linters and type checks where marked below.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# olivercode:validate-queue managed block, kept in step by sync-hooks and bootstrap
# One machine-wide queue for validation runs, held in OliverCode's scripts/lib/validate_queue.py.
# Without an OliverCode checkout the run goes ahead unqueued.
OC_QUEUE="$(dirname "$(readlink ~/.claude/CLAUDE.md 2>/dev/null)" 2>/dev/null)/scripts/lib/validate_queue.py"
if [[ -z "${OLIVERCODE_VALIDATE_SLOT:-}" && -f "$OC_QUEUE" ]]; then
  OLIVERCODE_VALIDATE_SLOT="$(python3 "$OC_QUEUE" acquire --pid $$ --label "$(basename "${REPO_ROOT:-$PWD}")" || true)"
  export OLIVERCODE_VALIDATE_SLOT="${OLIVERCODE_VALIDATE_SLOT:-none}"
  # A script's own EXIT trap wins: the queue reaps a slot whose process has exited, so nothing leaks.
  [[ -n "$(trap -p EXIT)" ]] || trap 'python3 "$OC_QUEUE" release "$OLIVERCODE_VALIDATE_SLOT" >/dev/null 2>&1 || true' EXIT
fi

if [[ -x .githooks/pre-commit ]]; then
  echo "=== validate: pre-commit gates ==="
  OLIVERCODE_SCAN_TREE=1 bash .githooks/pre-commit
fi

if [[ -f scripts/build-hooks.py ]]; then
  echo "=== validate: hook build check ==="
  python3 scripts/build-hooks.py --check
fi

if [[ -f scripts/check-structure-contract.mjs ]] && command -v node >/dev/null 2>&1; then
  echo "=== validate: structure contract ==="
  node scripts/check-structure-contract.mjs
fi

if [[ -f package.json ]] && command -v npm >/dev/null 2>&1 \
   && python3 -c "import json,sys; sys.exit(0 if 'validate' in json.load(open('package.json')).get('scripts',{}) else 1)"; then
  echo "=== validate: npm run validate ==="
  npm run -s validate
fi

echo "=== validate: tests ==="
for t in tests/*.test.mjs; do node "$t"; done

echo "=== validate: passed ==="
