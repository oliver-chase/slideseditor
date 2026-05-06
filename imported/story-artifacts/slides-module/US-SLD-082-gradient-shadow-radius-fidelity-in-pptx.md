Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-082
Title: Gradient, Shadow, and Border-Radius Fidelity in PPTX
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slide export user
I want modern CSS paint effects preserved in PPTX
So gradients, shadows, and rounded assets do not visually degrade

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Linear/radial gradients map with preserved direction and color stop order where PPTX supports equivalent constructs.
- [x] Box/text shadows map to closest editable PPTX effects with bounded visual drift.
- [x] Border radius mapping avoids white-halo artifacts on rounded images and clipped containers.
- [x] Unsupported effect combinations emit warnings that identify exact node/component ids.
- [x] Visual regression fixtures assert parity for gradients, shadows, and rounded-image scenarios.

Implementation Evidence:
- `functions/api/slides.js`
  - `parseGradientFill(...)` and `parseGradientStops(...)` preserve linear/radial gradient metadata, angle, and stop order in PPTX style projection output.
  - `parseShadow(...)` and `parseBorderRadiusValue(...)` map editable shadow and radius values and emit structured warnings for unsupported effect combinations.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - verifies gradient angle/stop fidelity, shadow vector mapping, border-radius projection, and warning records scoped to the exact affected slide/component ids.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
