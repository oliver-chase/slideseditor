Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-122
Title: Intelligent Reflow/Reposition Rules
Epic: SLD-STRAT-E3 Responsive Resize, Crop, and Aspect Intelligence
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want intelligent reflow/reposition rules
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Constrained elements (stack/grid/pinned) adapt predictably across aspect changes.
- [x] Unconstrained elements preserve relative location where possible.
- [x] Reflow warnings appear when manual intervention is required.

Required Tests:
- [x] `tests/contracts/slides-document.contract.test.mjs`

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- Added warning-aware responsive adaptation helper in `src/components/slides/document.ts`:
  - `adaptComponentsToResponsiveCanvasWithWarnings(...)`
  - Emits explicit manual-intervention warnings when unconstrained layers are clamped after aspect-ratio changes.
- Existing responsive constraint adaptation remains covered in `slides document contract: responsive adaptation reapplies layout constraints across aspect-ratio changes`.
- Added new contract coverage: `slides document contract: responsive adaptation emits manual-intervention warnings for unconstrained clamped layers`.
- Verification command pass:
  - `node --test tests/contracts/slides-document.contract.test.mjs` (`14/14`)
  - `npm run -s qa:hygiene` pass

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
