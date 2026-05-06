Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-121
Title: Canvas Target Presets + Custom Sizes
Epic: SLD-STRAT-E3 Responsive Resize, Crop, and Aspect Intelligence
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want canvas target presets + custom sizes
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Presets include 16:9, 4:3, 1:1 and custom dimensions.
- [x] Size switch updates canvas without data loss.
- [x] Resize action is undoable.

Required Tests:
- [x] `tests/e2e/slides-regression.spec.ts` — `US-SLD-121 supports canvas presets, custom dimensions, and undoable resize actions`

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- Added canvas preset controls (`16:9`, `4:3`, `1:1`) in `src/app/slides/page.tsx` resize panel, while preserving custom width/height inputs.
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-121"` passes (`1/1`).
- `npm run -s qa:hygiene` passes after implementation.

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
