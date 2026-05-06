Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-612
Title: Slides Mobile Click-Path and Overflow Certification
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a mobile operator
I want Slides journeys validated on phone-size layouts
So key actions remain reachable without overlap, hidden controls, or horizontal overflow

Acceptance Criteria:
- [x] Mobile e2e covers Slides tab transitions across Import, My Slides, Template Library, and Activity.
- [x] Mobile e2e validates chatbot-triggered workspace navigation in Slides.
- [x] Mobile e2e includes no-horizontal-overflow assertions for Slides journey checkpoints.
- [x] Mobile e2e includes at least one parse/edit/save path assertion (not route-shell only).
- [x] Mobile e2e includes visual overlap checks for chatbot panel/trigger versus workspace controls.

Execution Evidence (2026-04-26):
- Extended `tests/e2e/mobile-clickpaths.spec.ts` with:
  - `slides workspace tabs and chatbot flows remain mobile-safe`
  - tab-to-tab click-path assertions
  - chatbot command routing assertions
  - parse/edit/save journey assertions
  - mobile overflow checks per step
  - chatbot-trigger and workspace-control overlap assertions
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test --config=playwright.mobile.config.ts tests/e2e/mobile-clickpaths.spec.ts -g "slides workspace tabs and chatbot flows remain mobile-safe" --workers=1`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
