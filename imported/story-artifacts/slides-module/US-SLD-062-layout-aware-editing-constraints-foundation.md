Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-062
Title: Add Layout Constraint Foundation (Stack, Row, Grid, Pinned)
Epic: SLD-STRAT-E3 Responsive Resize, Crop, and Aspect Intelligence
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want optional layout-aware controls in addition to absolute positioning
So grouped content stays aligned as I edit and resize

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Default editing mode remains absolute positioning for backward compatibility.
- [x] Optional layout constraints support `stack`, `row`, `grid`, and `pinned` behaviors.
- [x] Constraint metadata supports alignment and spacing/gap settings.
- [x] Columns, stacks, cards, and grids can be managed without manual coordinate updates.
- [x] Pinned elements keep intended anchors when canvas dimensions change.

Implementation Evidence:
- `src/components/slides/types.ts`
  - added `SlideLayoutConstraint` metadata with `type`, `alignment`, `gap`, `columns`, and pinned-anchor fields.
- `src/components/slides/document.ts`
  - added pure helpers for stack/row/grid reflow and pinned anchor preservation during canvas-dimension changes.
- `src/app/slides/hooks/use-slides-editor-toolbar-mutations.ts`
  - added bounded `applyLayoutConstraintSelection(...)` mutation handling for selected layers.
- `src/app/slides/page.tsx`
  - added layout-constraint inspector controls and updated proportional canvas resize behavior so pinned elements keep anchor intent.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-document.contract.test.mjs`
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-062" --workers=1`
- Passed: `npm run typecheck`

Reference Model:

```ts
type LayoutConstraint = {
  type: 'stack' | 'row' | 'grid' | 'pinned'
  alignment?: 'left' | 'center' | 'right'
  gap?: number
}
```

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
