Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-050
Title: Reconstruct Rendered HTML Slides With Render-First Import Fidelity
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want HTML import to reconstruct rendered slide output instead of DOM hierarchy
So I can start editing immediately without manual visual rebuild

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Import executes in an isolated hidden iframe and does not parse raw DOM structure directly.
- [x] Import waits for DOM ready, `document.fonts.ready`, image load completion, and layout settle before measurement.
- [x] Slide root detection priority is `.page` then `[data-slide-root]` then `.slide-canvas` then `.slide` then `body`.
- [x] Bounds are extracted with `getBoundingClientRect()` relative to slide root coordinates.
- [x] Styles are extracted from `getComputedStyle()` (not inline-only style parsing).
- [x] Layout-only wrappers are skipped as text layers.
- [x] Import only includes visual leaf layers: direct-text leaves, images, and visually meaningful containers.
- [x] Layout wrappers such as `.wrap`, `.left`, and `.right` are not imported as giant text layers when they carry no direct visual/text payload.
- [x] Parent/child text duplication is prevented.
- [x] If a node has child elements, only direct text node content is imported for that node; if all visible text is represented by child elements, parent text import is skipped.
- [x] Visual cards/containers are preserved as editable shape/group-equivalent layers.
- [x] `.art` card structures are preserved as container shape/group-equivalent layers with child text layers (`.an`, `.al`, `.ad`) extracted separately.
- [x] `::before` accent bars are imported as thin shape layers when supported; otherwise importer emits warning and continues.
- [x] Data URI images are supported.
- [x] Imported slide background matches source instead of editor default fallback.
- [x] Imported output for fixed-size sample slides preserves two-column/card/logo structure without overlap.
- [x] Source coordinates are stored in canonical slide units and not pre-scaled into 1920×1080 viewport units.
- [x] Parser output canvas size is derived from detected source slide root dimensions (with default fallback) and renderer scaling is visual-only.
- [x] Text, widths, heights, and typography are scaled at most once by viewport fit/zoom, never by parser-side coordinate normalization.
- [x] For `slide-10-artifacts.html`, source canvas is treated as `.page`-driven 1900×1060 intent while preserving 16:9 editorial viewport rendering.

Notes:
- This story covers V1 critical import fidelity defects and parser correctness gates.

Progress Notes (2026-04-26):
- Added root-detection priority alignment: `.page` -> `[data-slide-root]` -> `.slide-canvas` -> `.slide` -> `body`.
- Added render-bound safeguard for oversized root measurements so body-level wrapper bounds do not compress imported output into tiny text/layout.
- Added post-parse auto-selection of the first visible imported layer so editor controls are immediately active after import without requiring a manual first click.
- Added regression coverage:
  - `SLD-FE-305` for `.page` root priority over lower-priority slide containers.
  - `SLD-FE-306` for oversized-root width normalization without tiny-text compression.
  - `US-SLD-003` frontend assertions now validate canonical 1280×720 input stays 1280×720 in parser output with unscaled node units.
  - `SLD-FE-300` now validates unscaled heading coordinates and typography when importing render-sized HTML.
  - `US-SLD-050` now validates immediate imported-layer selection and editable style controls after parse completion.

Implementation Evidence (2026-04-26):
- `src/components/slides/html-import.ts`
  - removed parser coordinate/typography scaling toward fixed viewport canvas defaults.
  - introduced source-canvas detection flow from inline, computed, and measured root dimensions.
  - canvas metadata now returns source dimensions for downstream visual fit scaling.
  - render measurement now executes inside an isolated hidden same-origin iframe with stylesheet replay before computed-style and bounds extraction.
  - absolute-positioned import filtering now skips neutral layout wrappers while preserving direct-text leaves and visually meaningful containers.
  - artifact-like surfaces such as `.art` are classified as editable card layers rather than generic text wrappers.
- `src/app/slides/hooks/use-slides-editor-persistence.ts`
  - selects the first visible imported component after parse hydration so edit controls are immediately enabled.
- `tests/e2e/frontend-smoke.spec.ts`
  - added/updated assertions for canonical parse output on non-1920 fixed-size HTML.
- `tests/e2e/slides-regression.spec.ts`
  - updated `SLD-FE-300` assertions for canonical coordinates and typography scaling behavior.
  - added `US-SLD-050` immediate-editability regression coverage.
  - added wrapper-skipping and parent/child text de-duplication regression coverage for `.wrap`, `.left`, `.right`, and `.art` structures.

Test Coverage Map:
- Hidden iframe render snapshot, computed-style extraction, and render-settle flow:
  - `tests/e2e/slides-regression.spec.ts`
  - `US-SLD-050 parsing HTML auto-selects an imported layer so editor fields are immediately editable`
- Root detection priority, measured bounds, canonical coordinates, and one-time scaling behavior:
  - `tests/e2e/slides-regression.spec.ts`
  - `SLD-FE-305 prioritizes .page root detection over lower-priority slide containers`
  - `SLD-FE-306 avoids tiny-text scaling when body bounds are much larger than imported layer bounds`
- Layout wrapper skipping, visual-card preservation, and parent/child text de-duplication:
  - `tests/e2e/slides-regression.spec.ts`
  - `US-SLD-050 skips layout-only wrappers and avoids parent-child text duplication`
- Fixed-size sample parity, data URI assets, pseudo-layers, and `.page`-driven `slide-10-artifacts.html` intent:
  - `tests/e2e/slides-regression.spec.ts`
  - `US-SLD-058 sample artifact fixture preserves parity signals and editable structure`

QA / Evidence Update (2026-04-27):
- Passing checks:
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-050|SLD-FE-305|SLD-FE-306|US-SLD-058|skips layout-only wrappers" --workers=1`
  - `npm run typecheck`
- Passing tests:
  - `US-SLD-050 parsing HTML auto-selects an imported layer so editor fields are immediately editable`
  - `US-SLD-050 skips layout-only wrappers and avoids parent-child text duplication`
  - `SLD-FE-305 prioritizes .page root detection over lower-priority slide containers`
  - `SLD-FE-306 avoids tiny-text scaling when body bounds are much larger than imported layer bounds`
  - `US-SLD-058 sample artifact fixture preserves parity signals and editable structure`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
