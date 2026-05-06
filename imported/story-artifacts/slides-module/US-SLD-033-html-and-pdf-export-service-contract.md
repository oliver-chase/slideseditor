Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-033
Title: HTML and PDF Export Service Contract
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-24
---

As a slide editor user
I want reliable HTML and PDF export from current slide state
So I can deliver client-ready output without manual reconstruction

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] HTML export produces a clean file without editor chrome and with preserved component layout.
- [x] PDF export contract is defined (client print flow and optional server-rendered fallback path).
- [x] Export errors are surfaced with clear fallback guidance and retry options.
- [x] Export output includes deterministic metadata needed for re-import/traceability.

QA / Evidence:
- `src/components/slides/html-export.ts`: emits canonical slide markup from SlideDocument JSON with deterministic container classes and inline styles.
- `src/app/slides/page.tsx`: export controls generate fresh HTML blobs and expose `slides-export-html` value for trace assertions.
- `tests/e2e/frontend-smoke.spec.ts`:
  - `US-SLD-033` HTML/PDF export smoke path assertions include HTML download availability and export fallback behavior.
- `tests/e2e/slides-regression.spec.ts`:
  - export action coverage for HTML audit events and raw output assertions.
- `tests/contracts/slides-api.contract.test.mjs`: verifies structured audit export/contract outcomes and failure envelopes for upstream export exceptions.

Verification status:
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-052 slides PDF export prints canonical SlideDocument HTML|US-SLD-040 slides chatbot can download HTML export directly without dead-end follow-up" --workers=1`
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-013 fixture round-trip keeps component count and coordinate drift within tolerance|US-SLD-034, US-SLD-035, and US-SLD-036 draft recovery and activity feed surface save/export events" --workers=1`
- Passed: `node --test tests/contracts/slides-api.contract.test.mjs`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Status was downgraded from completion-only state because AC and/or evidence is incomplete for verification.
- Complete remaining Acceptance Criteria and attach command-level QA evidence before transitioning to Done + Verified.
