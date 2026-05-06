Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-037
Title: Unsaved Change Guardrails for Workspace Navigation
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want clear unsaved-change guardrails when navigating between slide workspaces
So in-progress edits are not accidentally discarded

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides workspace navigation prompts for confirmation when unsaved changes exist.
- [x] Returning to the hub prompts for confirmation when unsaved changes exist.
- [x] Dismissed confirmations preserve current workspace and draft state.
- [x] Guardrail behavior is validated by automated browser regression coverage.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
