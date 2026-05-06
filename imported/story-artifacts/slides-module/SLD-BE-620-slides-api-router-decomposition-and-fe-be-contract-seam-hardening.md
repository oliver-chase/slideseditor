Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-620
Title: Decompose Slides API router and harden FE/BE contract seams
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a backend maintainer
I want `functions/api/slides.js` split into bounded handlers with explicit routing contracts
So FE/BE behavior drift is easier to detect and safer to evolve

Acceptance Criteria:
- [x] GET resources and POST actions are dispatched via explicit routing maps rather than a single monolithic conditional chain.
- [x] Resource/action handlers are split into focused modules by concern (slides/templates/governance/audit/export/telemetry).
- [x] Existing response envelopes and status semantics remain backward-compatible for current FE callers.
- [x] FE-critical contracts are backed by behavior tests for each route family (not only mocked happy-path payload shape checks).
- [x] Handler decomposition includes clear ownership and failure-class logging boundaries.

Scope / Owners:
- Primary module: Slides BE API
- Files in scope:
  - `functions/api/slides.js`
  - `functions/api/slides/*` (new handler modules as needed)
  - `tests/contracts/slides-api.contract.test.mjs`
  - `tests/contracts/slides-pptx-export.contract.test.mjs`
- Owners:
  - Slides BE owner
  - QA contract owner

QA / Evidence:
- Executed commands:
  - `node --test tests/contracts/slides-api-router-decomposition.contract.test.mjs`
  - `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs`
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-runtime-health-policy.contract.test.mjs tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs tests/contracts/slides-api-router-decomposition.contract.test.mjs`
  - `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-055|SLD-FE-500|US-SLD-054|US-SLD-103" --workers=1`
  - `node --test tests/contracts/slides-api-router-decomposition.contract.test.mjs tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs`
  - `npm run test:contracts`
- Evidence artifacts:
  - Added `GET_RESOURCE_HANDLERS` dispatch map in `functions/api/slides.js` and preserved `POST_ACTION_HANDLERS`.
  - Added `functions/api/slides/route-handler-groups.js` with concern-scoped grouping for GET resources and POST actions.
  - Added `tests/contracts/slides-api-router-decomposition.contract.test.mjs` to enforce explicit map dispatch.
  - Preserved structured error-envelope behavior by awaiting resource handler dispatch in GET path.
  - Split dispatch ownership into concern-scoped modules:
    - `functions/api/slides/get-resource-handlers.js`
    - `functions/api/slides/post-core-slide-handlers.js`
    - `functions/api/slides/post-governance-audit-handlers.js`
    - `functions/api/slides/post-export-telemetry-handlers.js`

Test Plan:
- Positive path: existing FE actions complete successfully on decomposed handlers.
- Negative path: unauthorized and malformed requests retain structured error envelopes.
- Regression path: export-job and governance endpoints maintain role/visibility behavior.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
