Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-132
Title: Multi-Slide Export Orchestration
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want multi-slide export orchestration
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Single and selected multi-slide export supported.
- [x] Async job lifecycle status is queryable and resilient.
- [x] Download endpoints enforce ownership/permissions.

Required Tests:
- [x] Contract: request/list/download PPTX job lifecycle semantics are validated.
- [x] Contract: download/list enforcement applies actor ownership/permission boundaries.
- [x] E2E: selected multi-slide export flow succeeds and writes lifecycle activity.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `node --test tests/contracts/slides-pptx-export.contract.test.mjs` -> pass, including request/list/download lifecycle and actor access enforcement.
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity"` -> pass (`1/1`).
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
