Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-057
Title: Preserve Editability and Canonical Coordinates After Canvas Normalization
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want normalized canvas display without losing editable canonical coordinates
So edits, autosave, and export remain accurate after import

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Imported text layers are selectable and directly editable.
- [x] Imported image/shape/card layers are selectable and independently movable/resizable.
- [x] Layer reorder, duplicate, and delete operations work on imported layers.
- [x] Group moves are supported when grouping is enabled.
- [x] Keyboard nudge controls apply to imported selections.
- [x] Viewport scale is visually separate from canonical slide coordinates.
- [x] Underlying SlideDocument coordinates remain canonical regardless of viewport zoom/fit mode.
- [x] Autosave and export use canonical coordinates from JSON, not scaled preview coordinates.

QA / Evidence:
- `npm run typecheck` passed.
- `node --test tests/contracts/slides-document.contract.test.mjs` passed.
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-057"` passed.
- Verified imported text layers can be edited inline, multi-select imported layers move together, imported layers can be reordered, duplicated, and deleted, and saved/exported coordinates remain canonical while viewport scale remains visual-only.

Progress Notes (2026-04-27):
- Added duplicate/delete selection support to the canvas interaction path for imported layers.
- Added imported-layer regression coverage for edit, multi-select move, reorder, duplicate/delete, save, and export canonical-coordinates behavior.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
