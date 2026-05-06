Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-040
Title: Chat-Driven HTML Export Download
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want an Oliver command that directly downloads HTML export
So export workflows do not dead-end after generation and remain fully executable in chat

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides commands include a fuzzy-discoverable `Download HTML Export` intent.
- [x] Chat flow runs direct HTML download and returns a completion confirmation message.
- [x] Command execution reuses existing export behavior and audit logging contract when a saved slide is active.
- [x] Frontend smoke test verifies command-triggered download and success confirmation.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
