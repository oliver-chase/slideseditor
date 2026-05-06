Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-101
Title: Robust HTML Input Intake
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a user, I can paste or upload HTML and always get clear validation feedback.
I want robust html input intake
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] `.html` and `.htm` accepted by upload.
- [x] Invalid type/empty markup blocked with explicit error copy.
- [x] Large files show deterministic size error before parse.
- [x] File content always appears in textarea before parse result.

Required Tests:
- [x] E2E: upload valid/invalid/empty/oversized cases.
- [x] Contract: validation function unit + edge matrix.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "US-SLD-055 accepts \\.htm uploads and rejects empty or plain-text upload payloads|US-SLD-055 imports large HTML uploads without leaving editor empty state|US-SLD-055 accepts full-document and fragment paste input after validation"` -> pass (`3/3`).
- `node --test tests/contracts/slides-import-validation.contract.test.mjs` -> pass (`4/4`) covering `.html/.htm` intake acceptance and invalid/oversized input guardrails.
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
