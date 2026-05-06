Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-102
Title: Multi-Root and Fragment Normalization
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a user, malformed but recoverable HTML is normalized into the first valid document root.
I want multi-root and fragment normalization
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Multiple `<html>` roots normalize to one import target.
- [x] Document fragments parse without requiring full `<html><body>` scaffolding.
- [x] Warning explains normalization behavior.

Required Tests:
- [x] E2E: multi-root fixture with warning assertion.
- [x] Unit/contract: root/fragment intake validation cases.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-102 normalizes multi-root html input|US-SLD-055 accepts full-document and fragment paste input after validation|SLD-FE-305 prioritizes \\.page root detection over lower-priority slide containers"` -> pass (`3/3`).
- `node --test tests/contracts/slides-import-validation.contract.test.mjs` -> pass (`4/4`) including full-document and fragment preflight acceptance.
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
