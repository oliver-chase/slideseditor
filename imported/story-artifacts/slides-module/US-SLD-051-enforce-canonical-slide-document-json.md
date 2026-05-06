Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-051
Title: Enforce SlideDocument JSON as Canonical Source of Truth
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want canvas, autosave, and export to run from one canonical SlideDocument JSON model
So edits remain consistent and deterministic across all operations

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Import output is normalized into canonical SlideDocument JSON and stored in editor state.
- [x] Canvas renderer reads only SlideDocument JSON state, never raw source HTML.
- [x] Autosave persists SlideDocument JSON snapshots.
- [x] Recovery mode restores SlideDocument JSON.
- [x] Export workflows read SlideDocument JSON and do not depend on original imported HTML.
- [x] Data model supports deck-level and slide-level shape (`SlideDeck` with `slides[]`, each slide with `elements[]` and optional `background`).

Implementation Evidence (2026-04-26):
- Added canonical SlideDocument helpers in `src/components/slides/document.ts`.
- `src/components/slides/types.ts` now carries `SlideDocument`/`SlideDeck` on editor parse state.
- HTML import now emits canonical document state alongside canvas/component projections.
- Save/autosave persist `metadata.slide_document` snapshots.
- Draft recovery restores canonical document state.
- Export JSON/HTML generation now reads canonical document state rather than component-array-only snapshots.
- Canvas and inspector mutation hooks now resync the canonical document after layer edits.

QA / Evidence (2026-04-26):
- `npm run typecheck`
- `node --test tests/contracts/slides-document.contract.test.mjs tests/contracts/slides-api.contract.test.mjs`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-013 fixture round-trip keeps component count and coordinate drift within tolerance|US-SLD-022 inline text editing and toolbar style controls update selected layers|US-O30 inspector bounds and text auto-size keep advanced layer editing deterministic|US-SLD-038 draft recovery appears for unsaved work and clears after successful save"`
- `npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-003 slides import sanitizes markup and warns on unsupported units/transforms|US-SLD-003 slides import normalizes coordinates and applies simple translate offsets"`

Reference Model:

```ts
type SlideDeck = {
  id: string
  width: number
  height: number
  slides: Slide[]
}

type Slide = {
  id: string
  elements: SlideElement[]
  background?: Background
}
```

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
