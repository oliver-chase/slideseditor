Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-625
Title: Execute browser-capable full Slides regression and interaction certification
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a release owner
I want full browser-capable Slides regression evidence
So interaction-critical functionality is certified beyond contract-level checks.

Acceptance Criteria:
- [x] `tests/e2e/slides-regression.spec.ts` is executed in a browser-capable environment against the promoted branch.
- [x] Failures (if any) are triaged into explicit story-linked defects with reproduction steps and file ownership.
- [x] Certified evidence includes parse/import, canvas manipulation, save/retry/degraded recovery, template governance, and export UX paths.
- [x] Results are logged in `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md` and `src/tech-debt/slides-qa-audit-status.md`.

Scope / Owners:
- Primary module: Slides
- Files in scope:
  - `tests/e2e/slides-regression.spec.ts`
  - `tests/e2e/slides-visual.spec.ts`
  - `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`
  - `src/tech-debt/slides-qa-audit-status.md`
- Owners:
  - Slides QA owner
  - Slides runtime owner

QA / Evidence:
- Initial browser run with correct E2E auth bypass exposed 6 real regressions after 77 passes:
  - Missing crop panel controls (`US-SLD-123`).
  - Missing layout constraint inspector and responsive adapt controls (`US-SLD-062`, `US-SLD-070`).
  - Missing theme controls (`US-SLD-061`).
  - Missing PPTX warning report download control (`SLD-FE-500` current-slide export).
  - Missing text alignment buttons used by visual toolbar coverage.
- Remediation restored these controls in `src/app/slides/page.tsx` and fixed component equality/cloning so layout/theme metadata changes persist even when geometry is unchanged.
- Verification:
  - `npm run -s typecheck` -> pass.
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-runtime-health-policy.contract.test.mjs tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-import-validation.contract.test.mjs tests/contracts/slides-document.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs tests/contracts/slides-pptx-export-dependency.contract.test.mjs tests/contracts/slides-interaction-inventory.contract.test.mjs tests/contracts/slides-visual-quality-gate.contract.test.mjs tests/contracts/slides-migration-verification.contract.test.mjs` -> pass (`58/58`).
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=slides-qa-placeholder PLAYWRIGHT_WEB_SERVER_PORT=3001 npx playwright test tests/e2e/slides-regression.spec.ts tests/e2e/slides-import-large.spec.ts tests/e2e/slides-visual.spec.ts --workers=1` -> pass (`83/83`).

Test Plan:
- Positive path: complete suite pass in browser-capable runtime.
- Negative path: each failure mapped to issue/story with deterministic reproduction.
- Regression path: rerun critical subsets after each fix until clean.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
