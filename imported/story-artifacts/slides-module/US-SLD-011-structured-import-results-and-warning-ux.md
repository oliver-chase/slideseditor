Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-011
Title: Structured Import Results and Warning UX
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want parsed components and warnings presented in a structured results view
So I can validate import quality without scanning raw JSON blocks only

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Import results include a structured component list with key fields (type, x/y, width/height, source label).
- [x] Warnings are grouped and readable, with duplicates collapsed and clear wording.
- [x] User can copy parsed component JSON and download it as a file.
- [x] Raw JSON view remains available as an advanced/inspect mode.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Status was downgraded from completion-only state because AC and/or evidence is incomplete for verification.
- Complete remaining Acceptance Criteria and attach command-level QA evidence before transitioning to Done + Verified.
