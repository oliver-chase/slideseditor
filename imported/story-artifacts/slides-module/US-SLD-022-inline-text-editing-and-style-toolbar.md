Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-022
Title: Inline Text Editing and Style Toolbar
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want to edit text directly on canvas with synchronized style controls
So copy and typography updates do not require raw JSON edits

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Text-capable components support inline edit mode with predictable enter/exit behavior.
- [x] Style controls show selected element style and update live for supported properties.
- [x] Font size enforces minimum 14px in UI and saved component state.
- [x] Style apply flow is reliable when focus transitions between canvas and toolbar controls.

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
