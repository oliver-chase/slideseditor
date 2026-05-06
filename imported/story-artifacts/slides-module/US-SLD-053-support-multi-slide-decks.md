Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-053
Title: Add Multi-Slide Deck Workflows
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to work with multiple slides in a deck
So I can build and deliver complete presentations in one workspace

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Deck model supports ordered slide collections.
- [x] User can create a new slide inside a deck.
- [x] User can duplicate existing slides.
- [x] User can delete slides.
- [x] User can reorder slides.
- [x] User can import HTML as a single new slide in current deck.
- [x] User can import HTML as a new deck.
- [x] Slide navigation is fast and stable across deck operations.
- [x] Slide-level autosave remains correct while working across multiple slides.
- [x] Data/persistence drift risks found in deck-save/autosave flows are linked to `docs/SUPABASE-AUDIT-GAP-LEDGER.md` before closure.

Implementation Evidence:
- Extended canonical document helpers in `src/components/slides/document.ts` to support active-slide sync, append, duplicate, delete, reorder, and active-slide projection from persisted metadata.
- Added deck-slide state and controls in `src/app/slides/page.tsx` for new/duplicate/delete/reorder/select plus import-as-new-slide and import-as-new-deck flows.
- Threaded active document-slide identity through editor persistence, draft recovery, canvas mutations, toolbar mutations, and PPTX export hooks so save/autosave/export stay scoped to the selected deck slide.

QA Evidence:
- `npm run typecheck`
- `node --test tests/contracts/slides-document.contract.test.mjs tests/contracts/slides-api.contract.test.mjs`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-053 supports multi-slide deck create, import, duplicate, reorder, delete, and save persistence"`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings"`
- `npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-052 slides PDF export prints canonical SlideDocument HTML"`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
