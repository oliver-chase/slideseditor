Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-623
Title: Harden e2e navigation retries against transient local webserver dropouts
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a QA owner
I want shared Playwright navigation helpers to tolerate short-lived local server disconnects
So Slides visual/regression suites remain reliable and avoid false negatives

Acceptance Criteria:
- [x] `tests/e2e/helpers/navigation.ts` treats transient transport failures (`ERR_CONNECTION_REFUSED`, `ERR_CONNECTION_RESET`, `ERR_CONNECTION_CLOSED`, `ERR_ABORTED`, detached-frame) as retryable.
- [x] Retry behavior uses bounded exponential backoff instead of fixed-delay retries.
- [x] Existing test call-sites remain unchanged (API-compatible helper update only).
- [x] Slides visual suite demonstrates stable repeatability after hardening.

Scope / Owners:
- Primary module: Slides QA automation
- Files in scope:
  - `tests/e2e/helpers/navigation.ts`
  - `tests/e2e/slides-visual.spec.ts` (verification only)
- Owners:
  - QA automation owner

QA / Evidence:
- Executed commands:
  - `npx playwright test tests/e2e/slides-visual.spec.ts --workers=1` (reproduced transient connection-refused instability in one run)
  - `for i in 1 2; do npx playwright test tests/e2e/slides-visual.spec.ts --workers=1 || exit 1; done` (post-fix repeat run stability check)
- Results:
  - Post-fix repeat validation: both runs passed (`3 passed` each run).

Test Plan:
- Positive path: all Slides visual tests pass under normal server lifecycle.
- Negative path: short-lived connection drops are retried before failing.
- Regression path: helper signature remains unchanged for all existing e2e tests.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
