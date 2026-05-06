Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-627
Title: Build Slides action-to-table and RLS contract matrix
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a platform maintainer
I want a complete action/resource to table/column/policy matrix
So backend behavior and Supabase governance can be validated without code rediscovery.

Acceptance Criteria:
- [x] Every `/api/slides` GET resource and POST action is mapped to touched table(s), expected column mutations, and policy assumptions.
- [x] Matrix includes ownership of each path (handler file/function), failure classes, and telemetry/audit side effects.
- [x] Matrix is stored in canonical Slides governance docs and linked from backlog/source-of-truth entrypoints.
- [x] Contract checks or checklist gates are defined for keeping matrix updated with future route/action changes.

Evidence:
- Published canonical matrix: `SLIDES-ACTION-TABLE-RLS-MATRIX.md`.
- Linked matrix from `README.md` and the Slides functional audit ledger.
- Added contract coverage in `tests/contracts/slides-api-router-decomposition.contract.test.mjs` that compares the matrix against every active GET resource and POST action in `functions/api/slides/route-handler-groups.js`.
- Verification: `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-api-router-decomposition.contract.test.mjs tests/contracts/slides-migration-verification.contract.test.mjs` -> PASS (`20/20`).

Closeout notes:
- During the inventory, `record-import-session-trace` was found to be memory-only despite the existing `slide_import_session_traces` migration. The handler now persists to Supabase and GET `import-session-traces` reads the table with actor scoping.
- `SLD-QA-626` is closed with documented no-op rationale for this workspace due to missing attributable linked Supabase project ref.

Scope / Owners:
- Primary module: Slides backend governance
- Files in scope:
  - `functions/api/slides.js`
  - `functions/api/slides/route-handler-groups.js`
  - `src/lib/slides.ts`
  - `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`
  - `.github/user-stories/oliver-app/backlog/slides-module/README.md`
- Owners:
  - Slides backend owner
  - Supabase governance owner

QA / Evidence:
- Required evidence:
  - Published matrix artifact in repo.
  - Validation checklist run against current action/resource inventory.
- Evidence status:
  - Complete.

Test Plan:
- Positive path: every active action/resource has one clear matrix row with table and policy expectations.
- Negative path: missing mapping entries fail validation checklist.
- Regression path: adding a new action/resource requires matrix update in same change set.
Current state: Needs review and backfill.
