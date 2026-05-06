Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-TECH-630
Title: Strengthen Slides contract gates to behavior-level assertions
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a QA owner
I want Slides contracts to validate runtime behavior rather than source-text presence
So gates fail on real regressions and not just file-shape drift

Acceptance Criteria:
- [x] `slides-decomposition.contract` no longer relies only on hook-name/file-exists checks.
- [x] `slides-runtime-health-policy.contract` no longer relies only on source regex slices.
- [x] At least one behavior-level contract verifies degraded-state policy via function invocation/mocks.
- [x] At least one behavior-level contract verifies decomposition boundaries via exported API/handler behavior expectations.
- [x] Contract suite failure output remains actionable with clear regression context.

Scope / Owners:
- Primary module: Slides contract tests
- Files in scope:
  - `tests/contracts/slides-decomposition.contract.test.mjs`
  - `tests/contracts/slides-runtime-health-policy.contract.test.mjs`
  - related helper fixtures/harness files
- Owners:
  - QA contract owner

QA / Evidence:
- Executed commands:
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-runtime-health-policy.contract.test.mjs`
    - passed (`4 passed`, `0 failed`).
  - `npm run test:contracts`
    - Slides contract updates passed; unrelated existing failure remains in campaigns contract (`tests/contracts/campaigns-api.contract.test.mjs`, webhook replay endpoint expectation mismatch).
- Evidence artifacts:
  - `tests/contracts/slides-runtime-health-policy.contract.test.mjs`
    - now performs runtime invocation checks for non-critical-read fallback, critical-mutation degraded-mode signaling, and recovery-to-normal behavior.
  - `tests/contracts/slides-decomposition.contract.test.mjs`
    - now verifies page-level handler wiring plus executable `useSlidesImportIngestion` behavior (picker delegation and invalid-file guardrails), replacing file-shape-only checks.
  - Assertion labels and failure text in both contracts are now behavior-specific and route/hook scoped, making regressions actionable.

Test Plan:
- Positive path: expected degraded-mode and orchestration behaviors pass.
- Negative path: intentional behavior regression fails contract with explicit message.
- Regression path: broader Slides contract suite remains green after test hardening.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
