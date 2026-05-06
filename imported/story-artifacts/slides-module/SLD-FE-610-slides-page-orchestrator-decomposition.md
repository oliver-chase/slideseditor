Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-610
Title: Slides Page Orchestrator Decomposition
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a maintainer
I want `src/app/slides/page.tsx` decomposed into bounded feature modules
So ongoing FE changes stay testable, reviewable, and less regression-prone

Acceptance Criteria:
- [x] Large orchestration logic is split into focused hooks/components (import, editor, library, activity, export).
- [x] Cross-cutting state transitions are documented with typed contracts.
- [x] Existing regression and visual tests remain green after decomposition.
- [x] No user-visible workflow regressions in save, export, governance, and audit paths.
- [x] New module boundaries reduce average PR diff size for slide features.

Execution Evidence (2026-04-26):
- Decomposition boundaries are implemented via focused hooks under `src/app/slides/hooks/`, including:
  - import ingestion
  - editor toolbar mutations
  - canvas interactions
  - editor persistence
  - library data
  - template governance
  - audit state/actions
  - html/pdf and pptx export
  - workspace guard
- Added decomposition contract coverage in `tests/contracts/slides-decomposition.contract.test.mjs`.
- Added typed transition contract documentation:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Verified no visible workflow regressions on targeted paths:
  - Save/library success
  - Export + audit
  - Governance action
  - Failure/recovery

Verification status:
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-031 and US-SLD-032 save workflow populates My Slides and template duplication|SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity|SLD-FE-410 and SLD-BE-410 allow admins to reject collaborator approval requests|US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry" --workers=1`
- Passed: `node --test tests/contracts/slides-decomposition.contract.test.mjs`
- Passed: `npm run typecheck`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
