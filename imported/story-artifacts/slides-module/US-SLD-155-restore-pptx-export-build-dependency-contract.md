Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-155
Title: Restore PPTX export build dependency contract for deploy stability
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a release owner
I want the Slides PPTX export dependency contract enforced in source control
So production builds do not fail with module resolution errors during deploy

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] `@halobiron/dom-to-pptx` is declared in `package.json` dependencies.
- [x] A Slides contract test fails when the dependency declaration is missing.
- [x] CI-equivalent production build completes with required Supabase placeholder env vars.

Scope / Owners:
- Slides FE owner
- QA/contracts owner

Files:
- `package.json`
- `tests/contracts/slides-pptx-export-dependency.contract.test.mjs`
- `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`

QA / Evidence:
- Reproduced failing CI build from run `25192489469`:
  - `Module not found: Can't resolve '@halobiron/dom-to-pptx'`
  - `src/app/slides/hooks/use-slides-pptx-export.ts:65`
- Validation commands:
  - `node --test tests/contracts/slides-pptx-export-dependency.contract.test.mjs`
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy-key npm run build`

Test Plan:
- Positive path: `node --test tests/contracts/slides-pptx-export-dependency.contract.test.mjs` verifies the dependency declaration is present.
- Negative path: the contract fails if `@halobiron/dom-to-pptx` is removed from `package.json`.
- Regression path: production build with placeholder Supabase env confirms module resolution succeeds during deploy-equivalent compilation.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after command-level QA evidence and governance checks were revalidated.
