Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-080
Title: DOM→PPTX Computed Style Mapping Foundation
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slide export user
I want DOM nodes mapped to PPTX using computed browser styles
So exported decks preserve authored layout/styles without raster screenshot fallback

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Export pipeline reads computed style values for text, box model, paint, and transform properties before PPTX projection.
- [x] Mapping contract is deterministic for identical DOM/CSS inputs (stable shape/text output ordering).
- [x] Unsupported mappings are surfaced as structured warnings with affected node references.
- [x] Export contract preserves editable object output as default behavior, not bitmap screenshots.
- [x] Contract tests cover baseline style-mapping correctness for representative DOM fixtures.

Implementation Evidence:
- `functions/api/slides.js`
  - `mapStyleProjection(...)` reads computed text, paint, effects, and transform style values into deterministic `style_projection` output.
  - `mapComponentToPptxNativeObject(...)` preserves editable `text` and `shape` native output by default and emits structured warning records with slide/component references.
  - `buildPptxNativeProjection(...)` normalizes component ordering before PPTX projection so identical slide inputs produce stable output ordering.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - covers deterministic computed-style mapping, unsupported transform warnings, flex layout projection parity, and effect projection fidelity/warning behavior.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
