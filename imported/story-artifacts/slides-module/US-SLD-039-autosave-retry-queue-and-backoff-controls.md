Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-039
Title: Autosave Retry Queue and Backoff Controls
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want autosave failures to queue with transparent retry behavior
So transient save issues do not silently lose my in-progress work

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Autosave failures enqueue retry state with bounded exponential backoff.
- [x] Retry queue state is visible in the UI with explicit retry-now and dismiss controls.
- [x] Online reconnect events can accelerate queued retry attempts.
- [x] Save status and error messaging distinguish between queued retries and terminal save failures.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
