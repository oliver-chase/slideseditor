Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-036
Title: Slides FE/BE Integration and Regression Suite
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a QA lead
I want an end-to-end regression suite for slide frontend/backend flows
So new editor capabilities ship with defensible reliability evidence

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Automated tests cover create/edit/save/autosave/load flows for slides.
- [x] Automated tests cover template duplication and library operations.
- [x] Automated tests cover HTML import plus export paths (including expected warning/failure branches).
- [x] CI executes slides integration coverage and fails on FE/BE contract regressions.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
