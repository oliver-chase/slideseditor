Owner: Unassigned
Last updated: 2026-05-04

---
ID: SMK-SLD-002
Title: Stabilize Slides Coordinate Normalization Expectations
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slides parser owner
I want coordinate normalization outputs to be deterministic and documented
So expected-value smoke assertions match intentional transform logic

Source Failure:
- `tests/e2e/frontend-smoke.spec.ts:1122`
- Scenario: `US-SLD-003 slides import normalizes coordinates and applies simple translate offsets`

Error Context:
- `test-results/frontend-smoke-frontend-sm-d2b7e-es-simple-translate-offsets-chromium/error-context.md`

Repro Command:
```bash
npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-003 slides import normalizes coordinates and applies simple translate offsets"
```

Acceptance Criteria:
- [x] Coordinate transform contract is explicit (including offset/rounding behavior).
- [x] Expected x/y values in smoke test match intentional parser output.
- [x] Focused repro command passes.

QA / Evidence:
- [x] Attach rerun log path for passing repro.
- [x] Attach updated error-context artifact or note `no error-context generated` on pass.

Execution Evidence (2026-04-26):
- Focused repro passed:
  - `npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-003 slides import sanitizes markup and warns on unsupported units/transforms|US-SLD-003 slides import normalizes coordinates and applies simple translate offsets"`
- Result:
  - `US-SLD-003 slides import normalizes coordinates and applies simple translate offsets` passed
- Error artifact note:
  - no error-context generated on passing rerun

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
