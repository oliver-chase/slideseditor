Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-085
Title: HTML Fragment to Native PPTX Animation Mapping
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a presenter using progressive reveals
I want fragment-style HTML reveal steps mapped to native PPT animations
So my slide timing/sequence is preserved without manual reauthoring

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Reveal-style fragment ordering maps to native PPT entrance animations (for example fade/fly-in) with deterministic sequence.
- [x] Animation mappings are configurable by effect profile (default, conservative, disabled).
- [x] Unsupported animation semantics degrade to static output with explicit warning entries.
- [x] Exported deck opens with valid animation timelines in desktop PowerPoint.
- [x] Coverage includes multi-fragment slides with mixed text/shape targets.

Implementation Evidence:
- `functions/api/slides.js`
  - added `animation_profile` sanitization plus PPTX `animation_manifest` generation from fragment/reveal metadata on exported components.
  - maps supported fragment targets to deterministic native entrance effects and emits scoped warnings for unsupported semantics or unmapped targets.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - verifies default, conservative, and disabled effect profiles plus mixed text/shape fragment ordering and unsupported animation warnings.

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
