Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-TECH-311
Title: Add Regression Coverage for External + Inline Style Cascade Order
Status: Done
Verified: true
Backdated: 2026-04-26
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Ticket: SLD-TE-311
Priority: P0
---

As a QA engineer
I want an explicit regression test for style order precedence across linked and inline CSS during import
So fidelity regressions are caught before merge.

Acceptance Criteria:
- [x] Test fixture imports HTML with a linked stylesheet setting initial styles then inline `<style>` overriding them.
- [x] Test asserts overridden color/font size are preserved exactly as last-in-order inline rules would produce.
- [x] Test exercises parser snapshot behavior without requiring companion file upload.
- [x] Test failure indicates changed cascade resolution behavior and blocks CI.
- [x] Test identifier is traceable to this ticket (`SLD-TE-311`).

Test Evidence:
- [x] `tests/e2e/slides-regression.spec.ts` includes `SLD-TE-311` visual parity check scenario.

Progress Notes:
- Uses request interception for linked stylesheet payload to keep test deterministic.

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
