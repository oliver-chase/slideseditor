Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-056
Title: Surface Structured Import Warnings for Unsupported Features
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want specific warnings for unsupported import features
So I can quickly judge fidelity risk and decide whether manual cleanup is needed

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Import warnings are structured, specific, and non-blocking unless parse is impossible.
- [x] Warning taxonomy includes at minimum: pseudo-elements not extracted, inaccessible external images, unsupported transforms, CSS animations, canvas elements, video elements, and unresolved external stylesheets.
- [x] Warnings include fallback behavior details when approximation/skipping is applied.
- [x] Unsupported style values are ignored with warning output, not silent failure.
- [x] Import completes with warnings whenever core slide extraction is still possible.

Progress Notes (2026-04-26):
- Added explicit fallback-reporting warnings when parser must import top-level nodes as fidelity fallback.
- Fallback imported layers are now marked locked and labeled with `(fallback)` source metadata.
- Added regression coverage `SLD-FE-304` for fallback warning visibility + locked-layer contract.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
