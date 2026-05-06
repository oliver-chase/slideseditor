Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-064
Title: Expand Advanced HTML Import Resilience
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want import to handle broader static design constructs
So fewer production slides require manual reconstruction

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Pseudo-element extraction support is improved beyond baseline bars/highlights.
- [x] SVG import is supported as image fallback and/or vector-native layer where feasible.
- [x] External stylesheet resolution is improved with explicit warning/report behavior.
- [x] Font embedding and fallback mapping rules are documented and enforced.
- [x] Unsupported constructs fail gracefully with actionable warnings.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-064"`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-307"`
- Verified warning and warning-source coverage for nested `@import`, pseudo-element extraction, fallback font mapping, and inline SVG fallback behavior in `tests/e2e/slides-regression.spec.ts`.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
