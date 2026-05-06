Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-104
Title: Fallback Safety for Unsupported Nodes
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a user, unsupported nodes are still represented so output is never blank.
I want fallback safety for unsupported nodes
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Unsupported sections import as locked fallback layers.
- [x] Warning taxonomy groups unsupported reasons.
- [x] Parse never returns empty canvas for non-empty valid HTML without explicit reason.

Required Tests:
- [x] E2E: unsupported structures produce locked fallback + warnings.
- [x] Unit: warning group classification.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-104 non-positioned html import never dead-ends|SLD-FE-307 surfaces warning taxonomy"` -> pass (`2/2`).
- `node --test tests/contracts/slides-import-validation.contract.test.mjs` -> pass (`4/4`), including preflight coverage for non-empty valid HTML handling.
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
