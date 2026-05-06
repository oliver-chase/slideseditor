Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-086
Title: SVG, Table, and Canvas Dashboard Export Parity
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As an analytics/dashboard user
I want SVG, HTML table, and canvas/chart surfaces to export reliably
So operational decks can be generated from modern web dashboard views

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] SVG nodes export as editable vector-friendly output when supported by PPT target format.
- [x] HTML tables export with preserved row/column structure, text values, and basic cell styling.
- [x] `<canvas>` chart surfaces export with stable visual parity and documented editability limits.
- [x] Export pipeline supports common dashboard chart libraries (for example ECharts/Chart.js) through deterministic fallback behavior.
- [x] Regression fixtures cover mixed dashboard slides containing SVG + table + canvas content.

Implementation Evidence:
- `functions/api/slides.js`
  - added `dashboard_surface_manifest` generation for SVG, HTML table, canvas, and chart-library dashboard surfaces.
  - classifies supported dashboard surfaces into deterministic export strategies and emits `dashboard_surface_rasterized` warnings for canvas/chart fallback paths.
- `src/components/slides/persistence-types.ts`
  - added persisted job typing for dashboard surface manifest entries.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - verifies mixed SVG + table + canvas + ECharts dashboard slides produce stable manifest output and scoped rasterization warnings.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`
- Passed: `npm run check-stories`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
