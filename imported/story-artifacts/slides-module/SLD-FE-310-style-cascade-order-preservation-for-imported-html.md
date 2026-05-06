Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-310
Title: Preserve HTML Style Cascade Order During Import Parsing
Status: Done
Verified: true
Backdated: 2026-04-26
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Ticket: SLD-FE-310
Priority: P0
---

As a slide editor user
I want linked and inline stylesheet order preserved during HTML import
So that cascade and specificity continue to match source design fidelity.

Acceptance Criteria:
- [x] The parser collects style sources from `<style>` and `<link rel="stylesheet">` in document order.
- [x] Linked stylesheet CSS is inlined in the same ordering position relative to inline style blocks.
- [x] The import snapshot is built from ordered style chunks, not from an unordered aggregation.
- [x] Existing imported layout, color, and typography fidelity regressions are not introduced across representative fixtures.
- [x] Any unresolved external stylesheet is surfaced as a structured warning rather than silent fallback.

Implementation Evidence:
- [x] `src/components/slides/html-import.ts` (`inlineExternalStylesheets`, `buildRenderSnapshot`)

Tests:
- [x] `tests/e2e/slides-regression.spec.ts` includes `SLD-FE-310` coverage for external then inline override order.

Progress Notes:
- This ticket captures the style-ordering fix added after reports of imported HTML appearing mini/unfidelity due global style precedence drift.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
