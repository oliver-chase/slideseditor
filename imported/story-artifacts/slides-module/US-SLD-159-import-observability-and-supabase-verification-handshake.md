Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-159
Title: Import observability and Supabase verification handshake
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slides platform owner
I want backend import observability and migration verification handshakes
So FE import diagnostics can be correlated with API/runtime traces and deployment confidence is auditable

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides API exposes a lightweight import session trace endpoint keyed by correlation id and actor.
- [x] Import session trace includes parse-start/parse-end/error/fallback counters and error taxonomy buckets.
- [x] Supabase migration verification checklist is codified in a scriptable gate for Slides schema/policies.
- [x] Release checklist links import session trace evidence with migration verification evidence.

Required Tests:
- [x] Contract: import observability endpoint schema and retention boundaries.
- [x] Contract: migration verification gate fails when required Slides tables/policies are missing.
- [x] E2E: FE diagnostics correlation id can be matched to backend trace record.

Implementation Notes:
- Created from QA audit gap: FE diagnostics improved, but BE traceability and migration-proof automation still rely on manual checks.

QA / Evidence:
- `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-migration-verification.contract.test.mjs`
- `PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-159" --workers=1`
- `npm run -s check:slides-migration-verification`

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
