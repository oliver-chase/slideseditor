Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-114
Title: Layer Grouping, Z-Order, and Lock Semantics
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want layer grouping, z-order, and lock semantics
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Group/ungroup preserves positional integrity.
- [x] Bring-forward/send-back updates z-order deterministically.
- [x] Locked groups enforce non-editability.

Required Tests:
- [x] `tests/e2e/slides-regression.spec.ts`

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- Implemented group/ungroup behavior with persistent `groupId/groupName` assignment and grouped selection behavior in:
  - `src/app/slides/page.tsx`
  - `src/app/slides/hooks/use-slides-canvas-interactions.ts`
- Added explicit lock/unlock toolbar controls to enforce non-editability of grouped locked layers.
- Added E2E coverage:
  - `US-SLD-114 enforces grouping, step z-order controls, and locked-group immutability`
- Verification command pass:
  - `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-114|US-SLD-065|US-SLD-023|US-SLD-027"` (`4/4`)

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
