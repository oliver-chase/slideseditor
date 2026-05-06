Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-010
Title: Import Preflight Validation and Guardrails
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want clear preflight checks before parsing imported HTML
So I can fix invalid input quickly and avoid confusing parser failures

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] File import validates type and size before parse starts and shows actionable validation errors.
- [x] Pasted HTML path validates empty/whitespace-only input and reports clear guidance.
- [x] Parse failures are categorized (invalid markup, unsupported layout, generic failure) with user-readable messages.
- [x] Error states are persistent and recoverable without reloading the page.

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
