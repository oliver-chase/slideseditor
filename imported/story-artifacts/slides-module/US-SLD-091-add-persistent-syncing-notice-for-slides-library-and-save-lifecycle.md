Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-091
Title: Add persistent syncing notice for Slides library and save lifecycle
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
---

As a Slides user,
I want an explicit persistent syncing notice during library refresh and save operations,
So I can tell when work is in-flight and avoid duplicate/conflicting actions.

Problem Statement:
- Users report no clear syncing notice in Slides while operations are running.
- Existing UI has loading/error panels and button-level labels, but no consistently visible global sync lifecycle indicator equivalent to Campaigns topbar status.

Observed/Related Code Touchpoints:
- `src/app/slides/page.tsx`
  - Save lifecycle state: `SaveStatus` (`clean|dirty|saving|saved|queued|error|conflict`).
  - Library lifecycle state: `libraryLoading`, `libraryError`, refresh action, and `Library sync issue` panel.
  - Editor notices are event-driven but not a persistent sync badge.
- `src/app/slides/slides.css`
  - State panel styles exist for loading/error; may need shared persistent status style variant.
- `src/app/slides/hooks/use-slides-editor-persistence.ts`
  - Save transitions and retry paths.
- `src/app/slides/hooks/use-slides-library-data.ts`
  - Library fetch/refresh lifecycle orchestration.

Relevant Existing Story Work (to link/dedupe while implementing):
- `US-SLD-031-save-api-and-autosave-state-contract.md`
- `US-SLD-036-slides-fe-be-integration-and-regression-suite.md`
- `US-SLD-038-scoped-draft-recovery-lifecycle-for-unsaved-edits.md`
- `US-SLD-039-autosave-retry-queue-and-backoff-controls.md`

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides workspace shows a persistent top-level sync status indicator (`Syncing`, `Synced`, `Error`) aligned with save and library lifecycle state.
- [x] Indicator updates deterministically for manual save, autosave queue, and library refresh operations.
- [x] Error state includes actionable recovery control (`Retry`/`Refresh`) and does not hide the originating context.
- [x] Status indicator behavior is covered by FE contract and e2e checks.
- [x] Indicator does not regress existing `Library sync issue` and degraded-mode surfaces.

Test Plan:
- `node --test tests/contracts/slides-document.contract.test.mjs tests/contracts/slides-import-validation.contract.test.mjs`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "save|sync|library|retry|degraded"`

QA / Evidence:
- State transition matrix:
  - manual/library refresh or autosave in-flight -> `Syncing`
  - healthy persisted/idle state -> `Synced`
  - failed refresh/save branch -> `Error` with actionable control text (`Retry` or `Refresh`)
- Command output excerpts:
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-runtime-health-policy.contract.test.mjs` (pass)
  - `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-034, US-SLD-035, and US-SLD-036 draft recovery and activity feed surface save/export events|US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry|US-O31 autosave enters degraded local-draft mode after retry budget is exhausted"` (pass, `3/3`)
  - `npm run -s qa:hygiene` (pass)
- Visual evidence:
  - Sync indicator and retry/refresh controls are covered by FE contract assertion and exercised by save/retry/degraded e2e paths above.

Bug Notes:
- Reported symptom: no syncing notice in Slides despite active save/refresh operations.
- Risk: duplicate submissions, confusion about persistence status, and false assumptions about completed writes.
