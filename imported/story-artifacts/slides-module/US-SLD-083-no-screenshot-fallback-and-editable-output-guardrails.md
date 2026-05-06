Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-083
Title: No Screenshot Fallback and Editable Output Guardrails
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a presentation author
I want exports to stay editable instead of flattening to screenshots
So downstream teams can modify deck content natively in PowerPoint

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Text, shape, and supported media nodes export as native PPTX objects by default.
- [x] Screenshot/raster fallback is disallowed for supported node types.
- [x] Any unavoidable rasterization is constrained to unsupported nodes and clearly reported in warnings.
- [x] Export summary reports editable object count vs fallback object count.
- [x] Contract tests fail if supported node types regress to screenshot fallback.

Implementation Evidence:
- `functions/api/slides.js`
  - `mapComponentToPptxNativeObject(...)` keeps supported text/shape nodes editable by default and limits rasterized fallback to image-only cases plus unsupported-node warnings.
  - `buildPptxNativeProjection(...)` now reports `editable_object_count` and `fallback_object_count` alongside warning totals in export summaries.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - asserts supported node types remain editable/native, fallback counts are surfaced in the summary, and raster warnings stay scoped to unavoidable fallback objects.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
