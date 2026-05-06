Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-021
Title: Selection, Drag, Resize, and Keyboard Nudge
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want direct component manipulation controls on canvas
So layout adjustments are fast and precise

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Single-click selects one component and exposes selection affordances.
- [x] Drag interaction updates component coordinates in real time and commits on release.
- [x] Resize handle updates width (and supported height rules) with minimum-size guardrails.
- [x] Arrow keys nudge selected component(s) by 1px and Shift+Arrow by 10px.

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
