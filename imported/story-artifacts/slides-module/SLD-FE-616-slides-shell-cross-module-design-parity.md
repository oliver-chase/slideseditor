Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-616
Title: Slides Shell Cross-Module Design Parity
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a cross-module operator
I want Slides shell and workspace visuals to mirror shared module standards
So switching between modules does not create inconsistent control behavior, spacing, or state readability

Acceptance Criteria:
- [x] Slides primary shell regions (header, nav tabs, workspace cards, control bars) conform to shared token usage and spacing conventions used across active modules.
- [x] Empty, loading, and error states in Slides follow the same information hierarchy and action affordances as other module surfaces.
- [x] Responsive behavior for Slides workspace cards and control bars matches cross-module mobile-safe patterns (no hidden primary action paths, no overlap with chatbot trigger).
- [x] A design parity audit artifact documents any intentional deviations and their rationale.
- [x] Regression gates include a Slides-specific design parity assertion set for critical states (import empty, parse error, my-slides empty, template empty, activity empty/error).

Execution Evidence (2026-04-26):
- Added shared Slides state-surface treatment in `src/app/slides/page.tsx` and `src/app/slides/slides.css` for:
  - import parse error
  - library sync warning/error
  - my-slides empty
  - template empty/search-empty
  - template loading
  - audit export jobs empty
  - activity empty/filter-empty
- Added parity audit artifact:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Focused regression coverage:
  - `tests/e2e/slides-regression.spec.ts`
    - `SLD-FE-616 surfaces parity state cards for import error and empty workspaces`
- Validation:
  - `npm run typecheck`
  - `npm run build`
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-616 surfaces parity state cards for import error and empty workspaces"`

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
