Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-081
Title: Flexbox Layout Resolution Parity for PPTX
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slide export user
I want flexbox-driven DOM layout resolved to stable PPTX coordinates
So element positioning does not shift between HTML canvas and exported deck

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Row/column flex containers export with coordinate fidelity for `justify-content`, `align-items`, and `gap`.
- [x] Nested flex containers resolve child offsets without cumulative drift.
- [x] Text and shape boxes in flex contexts maintain expected size/alignment after export.
- [x] Unsupported flex behaviors emit explicit warning entries instead of silent fallback.
- [x] Regression fixtures include deep nested flex scenarios (including Tailwind-like utility class layouts).

Implementation Evidence:
- `functions/api/slides.js`
  - `mapLayoutProjection(...)` preserves absolute PPTX coordinates while projecting flex `justify-content`, `align-items`, `flex-direction`, `gap`, and warning-bearing wrap metadata.
  - `buildPptxNativeProjection(...)` normalizes component ordering before export so nested flex trees with identical inputs remain deterministic.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - verifies flex alignment/gap projection, unsupported flex warnings, and deep nested utility-style flex fixtures with stable ordering and preserved child box coordinates.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
