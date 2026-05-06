Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-133
Title: Format Parity: HTML/PDF/reveal.js
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want format parity: html/pdf/reveal.js
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] HTML export round-trips into parser with bounded drift.
- [x] PDF/reveal.js exports represent active slide order and dimensions.
- [x] Failure states include retry guidance.

Required Tests:
- [x] `tests/e2e/slides-regression.spec.ts` (`US-SLD-013`, `US-SLD-063`, `US-SLD-133`)
- [x] `tests/contracts/slides-document.contract.test.mjs` (`convertSlideDocumentToRevealHtml preserves deck order as reveal.js sections`)

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- Added explicit PDF failure retry guidance in `src/app/slides/hooks/use-slides-html-pdf-export.ts`:
  - `PDF export failed. Retry after enabling pop-ups, or use HTML export and browser print as fallback.`
- Added E2E guardrail coverage:
  - `US-SLD-133 shows retry guidance when PDF export popup is blocked`
- Confirmed HTML export parity and bounded drift path via:
  - `US-SLD-013 fixture round-trip keeps component count and coordinate drift within tolerance`
  - `US-SLD-063 exports active slide HTML with canonical dimensions`
- Confirmed reveal.js deck-order/dimension parity via contract coverage:
  - `slides export contract: convertSlideDocumentToRevealHtml preserves deck order as reveal.js sections`
- Verification command pass:
  - `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-063|US-SLD-133|US-SLD-013"` (`3/3`)

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
