Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-610
Title: Slides Long-Run E2E Stability Harness
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a release owner
I want a deterministic Slides-only stable harness
So Slides validation can run repeatedly without default web-server port collisions or unrelated module noise

Acceptance Criteria:
- [x] Slides has a dedicated stable harness command that builds once, serves the static app on an isolated configurable port, and runs the Slides suites against that external target.
- [x] Harness supports repeatable execution for long-run validation without requiring manual server lifecycle steps.
- [x] Module docs include the reproducible stable commands for local and external Slides validation.
- [x] Focused harness verification passes in-thread.

QA / Evidence:
- Passing commands:
  - `npm run typecheck`
  - `bash scripts/run-playwright-slides-stable.sh --list`
  - `bash scripts/run-playwright-slides-stable.sh tests/e2e/slides-regression.spec.ts -g "SLD-FE-616 surfaces parity state cards for import error and empty workspaces"`
- Harness notes:
  - default suite scope is Slides-only (`tests/e2e/slides-regression.spec.ts`, `tests/e2e/slides-visual.spec.ts`)
  - `SLIDES_STABLE_REPEAT_COUNT` repeats the already-built run against the same isolated static target

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
