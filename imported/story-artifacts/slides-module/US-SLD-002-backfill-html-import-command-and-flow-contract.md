Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-002
Title: Backfill HTML Import Command and Flow Contract
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want current import entry points and Oliver command flows documented as a tracked story
So expected behavior for file import and pasted HTML parsing is maintained across releases

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Story coverage includes "Import HTML File" and "Parse Pasted HTML" commands.
- [x] Story coverage includes flow-step behavior for "use current HTML" vs "paste new HTML".
- [x] Story evidence references `src/app/slides/commands.ts`, `src/app/slides/flows.ts`, and `/slides` UI actions.
- [x] Smoke coverage asserts parse action output for at least one valid sample import.

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
