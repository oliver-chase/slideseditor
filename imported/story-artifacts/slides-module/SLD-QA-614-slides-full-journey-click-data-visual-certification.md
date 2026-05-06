Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-614
Title: Slides Full Journey Click Data and Visual Certification
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a module owner
I want full Slides user-journey certification across click paths, data mapping, and visual overlap
So releases do not introduce hidden regressions in real operator workflows

Acceptance Criteria:
- [x] Journey matrix includes canonical paths for Import, My Slides, Template Library, Activity, and key cross-module transitions.
- [x] Each path has explicit click-count budgets and flagged detours with remediation notes.
- [x] Data-mapping checkpoints are captured for parse payloads, canonical component JSON, save mutation payloads, list/query params, and export jobs.
- [x] Visual risk checks include overlap, truncation, layering/z-index, and responsive reflow in desktop and mobile breakpoints.
- [x] E2E evidence covers success and failure paths for parse/edit/save/export plus governance actions without dead-end states.
- [x] Signoff artifact includes residual risk list, deferred debt, and targeted regression test IDs.

Execution Evidence (2026-04-26):
- Expanded journey matrix and click-budget/remediation notes:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Added signoff artifact with targeted regression IDs and residual risks:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Added targeted E2E journey evidence:
  - Success save/library: `US-SLD-031 and US-SLD-032 save workflow populates My Slides and template duplication`
  - Export + audit: `SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity`
  - Governance action: `SLD-FE-410 and SLD-BE-410 allow admins to reject collaborator approval requests`
  - Failure + recovery: `US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry`

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
