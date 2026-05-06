Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-613
Title: Slides Journey Depth Matrix and Parity Audit
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a product/qa lead
I want a Slides-specific depth matrix for click paths, data mapping, and visual parity
So we can prove complete journey coverage beyond surface smoke checks

Acceptance Criteria:
- [x] Matrix documents critical Slides journeys with explicit click-path counts and branch outcomes (happy, denied, failed, recovery).
- [x] Matrix maps frontend actions to backend contracts and data entities (slide/template/audit/export job) including source-of-truth fields.
- [x] Matrix tracks visualization risks (overflow, overlap, hidden controls, stale states) for desktop and mobile breakpoints.
- [x] Matrix includes chatbot fuzzy-intent coverage for each journey with exact command/alias mapping.
- [x] Matrix includes cross-module consistency checks where Slides shares shell or interaction patterns with other modules.
- [x] Release checklist references this matrix as a required signoff artifact before promotion.

Execution Evidence (2026-04-26):
- Added Slides journey depth matrix:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Added release-checklist reference to this matrix in US-O33 release gate checklist.

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
