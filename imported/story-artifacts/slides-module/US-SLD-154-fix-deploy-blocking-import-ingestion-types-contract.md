Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-154
Title: Fix deploy-blocking type contract regression in import ingestion warnings
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a release owner
I want Slides import-ingestion warning code to respect typed payload contracts
So CI typecheck and deploy gates remain green for Slides releases

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] `use-slides-import-ingestion.ts` treats `ignoredCssFiles` as `string[]` and no longer dereferences `.name`.
- [x] A regression contract test blocks reintroduction of `.map((file) => file.name)` against `ignoredCssFiles`.
- [x] CI-equivalent `npm run typecheck` passes on the patched head.

Scope / Owners:
- Slides FE owner
- QA/contracts owner

Files:
- `src/app/slides/hooks/use-slides-import-ingestion.ts`
- `tests/contracts/slides-import-ingestion-types.contract.test.mjs`

QA / Evidence:
- Reproduced CI failure from runs:
  - `25191998954` (staging): `TS2339 Property 'name' does not exist on type 'string'`
  - `25192027614` (main): same failure path and line.
- Validation commands:
  - `npm run typecheck`
  - `node --test tests/contracts/slides-import-ingestion-types.contract.test.mjs`

Test Plan:
- Positive path: `node --test tests/contracts/slides-import-ingestion-types.contract.test.mjs` verifies `ignoredCssFiles` is handled as a string list.
- Negative path: the same contract fails if `.map((file) => file.name)` is reintroduced for `ignoredCssFiles`.
- Regression path: `npm run typecheck` confirms the deploy-blocking TypeScript contract remains green.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after command-level QA evidence and governance checks were revalidated.
