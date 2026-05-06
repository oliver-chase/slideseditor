Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-131
Title: PPTX Native Object Priority
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want pptx native object priority
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Text/shape/image components map to editable PPTX-native objects where supported.
- [x] Unsupported constructs are explicitly listed in warning report.
- [x] Artifact metadata includes generation profile and fidelity notes.

Required Tests:
- [x] Contract: PPTX export projection maps native object payloads and warning classes deterministically.
- [x] Contract: unsupported constructs and fidelity warnings are emitted in export artifacts.
- [x] E2E: selected multi-slide PPTX export records `export-pptx` lifecycle activity.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `node --test tests/contracts/slides-pptx-export.contract.test.mjs tests/contracts/slides-pptx-export-dependency.contract.test.mjs` -> pass (native projection, warnings, idempotency/dependency gates, and export job semantics).
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity"` -> pass (`1/1`).
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
