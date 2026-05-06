Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-340
Title: Canvas Snapping Guides and Precision Layout
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want snapping, alignment guides, and spacing hints while moving/resizing layers
So I can create precise layouts without manual pixel nudging loops

Acceptance Criteria:
- [x] Drag and resize interactions snap to nearby object and canvas targets within tolerance.
- [x] Visual guides appear for nearby horizontal and vertical alignments during manipulation.
- [x] Snapping applies during direct manipulation without breaking fine-grain placement outside tolerance windows.
- [x] Multi-select alignment/distribution tooling works alongside the snapping-guides workflow.
- [x] Keyboard accessibility and existing guardrails (locked layers, bounds) remain intact.

Implementation Evidence:
- Added canvas snap target resolution and guide-state handling in `src/app/slides/hooks/use-slides-canvas-interactions.ts`.
- Rendered live snap guides in `src/app/slides/page.tsx` and `src/app/slides/slides.css`.
- Kept multi-select alignment/distribution flows integrated through existing editor toolbar mutations and selection state handling.

QA Evidence:
- `npm run typecheck`
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-340 shows snapping guides and snaps dragged layers to nearby targets|US-SLD-023 supports shift multi-select, group nudge, align, and distribution feedback" --workers=1`

Notes:
- Optional grid-step snapping presets remain follow-on optimization work and are tracked only as residual backlog/debt, not as part of this shipped story scope.

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
