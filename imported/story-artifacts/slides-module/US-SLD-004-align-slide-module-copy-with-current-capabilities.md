Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-004
Title: Align Slide Module Copy With Current Capabilities
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want labels, prompts, and helper text to match what the module can actually do today
So the UI does not promise non-existent template or export workflows

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slide module registry description and default greeting are updated to reflect current import-first capability.
- [x] Slides quick conversation prompts avoid implying implemented template/export flows that are not available.
- [x] Any future functionality references are clearly labeled as backlog/coming-soon.
- [x] Smoke or snapshot checks cover at least one canonical headline/subtitle string on `/slides`.

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
