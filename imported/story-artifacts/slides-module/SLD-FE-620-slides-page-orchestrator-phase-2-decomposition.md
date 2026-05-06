Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-620
Title: Slides page orchestrator decomposition phase 2
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a Slides maintainer
I want orchestration logic in `page.tsx` decomposed into bounded modules
So feature iteration and regression isolation are faster and safer

Acceptance Criteria:
- [x] `src/app/slides/page.tsx` is reduced by extracting remaining non-render orchestration into dedicated hooks/modules.
- [x] Extracted modules have explicit ownership boundaries (import, deck ops, editor state, export orchestration, governance/audit orchestration).
- [x] No behavior drift on critical journeys (import/edit/save/template/export/audit).
- [x] Decomposition contract verifies behavior-level invariants, not only hook name/file presence.
- [x] Updated module docs include decomposition map and ownership boundaries.

Scope / Owners:
- Primary module: Slides FE orchestration
- Files in scope:
  - `src/app/slides/page.tsx`
  - `src/app/slides/hooks/*.ts`
  - `tests/contracts/slides-decomposition.contract.test.mjs`
  - `tests/e2e/slides-regression.spec.ts`
- Owners:
  - Slides FE owner

QA / Evidence:
- Executed commands:
  - `npm run typecheck`
  - `npm run check-stories`
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-api-router-decomposition.contract.test.mjs tests/contracts/slides-story-status-enum.contract.test.mjs`
  - `PLAYWRIGHT_WEB_SERVER_PORT=3001 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy-key npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-031 and US-SLD-032 save workflow populates My Slides and template duplication|SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings|US-SLD-028 library and activity search show actionable empty states instead of dead-end messaging" --workers=1`
- Evidence artifacts:
  - Extracted helper module: `src/app/slides/helpers/page-orchestrator-utils.ts`
  - Page reduction: `src/app/slides/page.tsx` from `5095` lines to `4940` lines
  - Decomposition contract strengthened with helper-extraction invariant checks

Test Plan:
- Positive path: key editing and workspace transitions remain functionally unchanged.
- Negative path: malformed import/export operations still produce bounded error handling.
- Regression path: SLD-FE-617 degraded-mode behavior remains preserved.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
