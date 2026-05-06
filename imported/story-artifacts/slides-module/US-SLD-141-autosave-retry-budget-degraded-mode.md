Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-141
Title: Autosave + Retry Budget + Degraded Mode
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want autosave + retry budget + degraded mode
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Autosave retries with bounded backoff.
- [x] Critical mutation failures trigger degraded mode with clear status.
- [x] Non-critical read failures do not trigger full degraded mode.

Required Tests:
- [x] E2E: autosave retry queue/backoff and manual retry recovery.
- [x] E2E: degraded mode after retry budget exhaustion.
- [x] Contract: runtime policy distinguishes non-critical read fallback from critical mutation degradation.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry|US-O31 autosave enters degraded local-draft mode after retry budget is exhausted|SLD-FE-617 template endpoint fallback does not trigger global degraded local-draft banner"` -> pass (`3/3`).
- `node --test tests/contracts/slides-runtime-health-policy.contract.test.mjs` -> pass (`2/2`).
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
