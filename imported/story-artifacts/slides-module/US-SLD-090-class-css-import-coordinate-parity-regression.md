Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-090
Title: Restore class-based CSS import coordinate parity for heading layers
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a slide editor user
I want class-based HTML/CSS imports to preserve expected absolute coordinates
So imported slides match authored layout intent without hidden position drift

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] `tests/e2e/slides-regression.spec.ts` scenario `SLD-FE-300 imports class-based CSS layout, colors, and typography from HTML slides` passes on current `main` test baseline.
- [x] Root cause for heading `y` drift (`expected 90`, `observed 128`) is identified and documented in implementation notes.
- [x] Import normalization preserves class-based absolute offsets deterministically for heading and panel layers when inline style is absent.
- [x] Added or updated fixture coverage protects against regression for class-based `top` and line-height interactions.
- [x] Story evidence includes updated command output and explicit pass artifact references.

Scope / Owners:
- Primary module: Slides FE import parsing/rendering
- Files in scope:
  - `src/components/slides/html-import.ts`
  - `tests/e2e/slides-regression.spec.ts`
  - `tests/fixtures/slides/class-css-coordinate-line-height.html`
- Owners:
  - FE import pipeline owner
  - QA regression owner

QA / Evidence:
- Root-cause implementation notes:
  - Class-defined `top/left` values were not being used for coordinates because import normalization only read inline style declarations for positional fields.
  - In class-based heading cases, `y` fell back to layout metrics (`offsetTop` / measured bounds) that include default `h1` top margin, producing drift (`90` expected vs `128` observed).
  - Fix: import parsing now reads computed `left/top` when inline values are absent and uses those canonical values before layout fallbacks.
- Executed commands:
  - `npm run typecheck` -> passed.
  - `node --test tests/contracts/slides-import-validation.contract.test.mjs tests/contracts/slides-document.contract.test.mjs` -> 17 passed, 0 failed.
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-300 imports class-based CSS layout, colors, and typography from HTML slides" --workers=1` -> passed (`1 passed`).
- Coverage artifact updates:
  - Added fixture: `tests/fixtures/slides/class-css-coordinate-line-height.html`.
  - Updated regression scenario to use fixture-backed class CSS import input.
- Playwright artifacts:
  - Pass run produced no failure trace; command output captured in this story evidence.

Test Plan:
- Positive path: class-based heading/panel import preserves authored positions/styles.
- Negative path: malformed or partial class selectors still degrade safely with warnings.
- Regression path: existing SLD-FE-301/SLD-FE-310 coverage remains green after the fix.
