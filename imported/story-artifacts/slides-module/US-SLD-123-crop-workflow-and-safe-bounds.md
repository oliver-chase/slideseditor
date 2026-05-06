Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-123
Title: Crop Workflow and Safe Bounds
Epic: SLD-STRAT-E3 Responsive Resize, Crop, and Aspect Intelligence
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a slide editor user
I want to crop the visible canvas area safely
So I can fit imported content to a presentation size without corrupting the source layers

Module Scope:
- Primary module: Slides frontend canvas transform controls.
- Files in scope:
  - `src/app/slides/page.tsx`
  - `src/components/slides/document.ts` if helper extraction is required
  - `tests/e2e/slides-regression.spec.ts`
  - `.github/oliver-app/modules/slides-module/SLIDES-INTERACTION-INVENTORY.json`
- Owners: Slides frontend implementation and Slides QA coverage.

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Users can enter crop x/y/width/height values and apply a crop to the current canonical SlideDocument canvas.
- [x] Crop shifts layer coordinates predictably while preserving layer content and style data.
- [x] Invalid crop rectangles are blocked with user-visible guidance and do not mutate canvas state.
- [x] Layers outside the crop are preserved in the document and surfaced through a warning/notice instead of being silently deleted.
- [x] Crop is reversible from the UI after apply.
- [x] Crop controls are added to interaction inventory with positive and negative test refs.

Implementation Evidence:
- `src/app/slides/page.tsx` adds Canvas Crop controls for x/y/width/height plus Apply Crop and Reset Crop.
- Crop is implemented as a canonical `SlideDocument` transform: deck dimensions update, slide elements shift by the crop origin, style/layout metadata is preserved, and out-of-bounds layers remain in the model.
- Invalid crop rectangles are rejected before mutation.
- Reset Crop restores the pre-crop document snapshot captured before the first crop.
- Component-level undo history is cleared for full-document crop/resize transforms to avoid partial document rollback.
- Crop restore state is cleared when later document mutations occur (new deck, new slide, deck create/duplicate/delete/reorder, theme application, resize, load/delete active slide) so Reset Crop cannot resurrect stale deck state.
- `.github/oliver-app/modules/slides-module/SLIDES-INTERACTION-INVENTORY.json` maps crop apply/reset controls and test refs.

QA / Evidence:
- Passed: `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-123|US-SLD-115|SLD-FE-302" --workers=1` -> 4 passed.
- Passed: `npx playwright test tests/e2e/slides-regression.spec.ts --workers=1` -> 70 passed.
- Passed: `npx playwright test tests/e2e/slides-visual.spec.ts --workers=1` -> 3 passed.
- Passed: `npm run test:contracts` -> 169 passed.
- Passed: `npx tsc --noEmit`.
- Passed: `npm run build`.
- Passed: `git diff --check -- <Slides editor/story files>`.
- Passed: `npm run audit:slides-lifecycle`.

Test Plan:
- Positive path covered by `US-SLD-123 applies, rejects, and resets safe canvas crop rectangles`.
- Negative path covered by invalid crop rectangle rejection and unchanged canvas width assertion.
- Reversible path covered by Reset Crop restoring canvas dimensions and original layer coordinates.
- Stale-state regression covered by disabling Undo after full-document crop, disabling Reset Crop after importing a new slide post-crop, and disabling Undo after full-document proportional resize.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
