Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-013
Title: Import/Export Round-Trip Fixture Reliability
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a QA lead
I want fixture-based round-trip reliability checks for slide HTML conversion
So parser changes do not silently break re-import quality

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Canonical slide HTML fixtures are committed for representative layout patterns.
- [x] Tests validate import output invariants (component count, key coordinates, type inference) against fixtures.
- [x] Round-trip checks enforce drift tolerance thresholds for x/y/width after export then re-import.
- [x] Round-trip tests run in CI and fail on contract-breaking parser regressions.

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
