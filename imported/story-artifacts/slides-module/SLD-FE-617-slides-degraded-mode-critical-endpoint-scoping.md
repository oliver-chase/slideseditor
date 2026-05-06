Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-617
Title: Slides Degraded Mode Critical Endpoint Scoping
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slide editor user
I want degraded-mode messaging to trigger only for critical slide-runtime failures
So read-only template/service noise does not incorrectly indicate full editor degradation

Acceptance Criteria:
- [x] Template read fallback paths (`resource=templates`, `resource=archived-templates`) continue to local data fallback without forcing global `Degraded Mode: Local Draft` banner state.
- [x] Critical mutation failures (save/export/publish/update/delete actions) still trigger degraded-mode runtime health signal and keep retry metadata visible.
- [x] Slides runtime health behavior remains deterministic for explicit local-only mode and does not regress existing retry/recovery controls.
- [x] e2e coverage proves template endpoint outage does not surface degraded banner while template workspace remains usable.
- [x] Contract-level test coverage exists for runtime health signal policy by endpoint class (critical mutation vs optional read).

Execution Evidence (2026-04-26):
- Updated `src/lib/slides.ts`:
  - `listSlides(...)` now uses local fallback with suppressed degraded-state signal.
  - `listTemplates(...)` now uses local fallback with suppressed degraded-state signal.
  - `listArchivedTemplates(...)` now uses local fallback with suppressed degraded-state signal.
- Added regression test in `tests/e2e/slides-regression.spec.ts`:
  - `SLD-FE-617 template endpoint fallback does not trigger global degraded local-draft banner`
- Added contract policy coverage in `tests/contracts/slides-runtime-health-policy.contract.test.mjs`:
  - My Slides/template/archived-template reads suppress degraded state
  - critical mutations keep degraded-state signaling enabled
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-617 template endpoint fallback does not trigger global degraded local-draft banner" --workers=1`
  - Passed: `node --test tests/contracts/slides-runtime-health-policy.contract.test.mjs`

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
