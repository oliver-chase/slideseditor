Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-038
Title: Scoped Draft Recovery Lifecycle for Unsaved Edits
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want per-user draft recovery that appears only for unsaved work
So crash recovery is reliable without stale draft prompts

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Draft recovery keys are scoped per user to avoid cross-user collisions.
- [x] Legacy draft keys are migrated safely to the scoped format.
- [x] Successful save clears local recovery draft state so recovery banners do not persist incorrectly.
- [x] Draft recovery lifecycle behavior is covered by automated browser regression tests.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
