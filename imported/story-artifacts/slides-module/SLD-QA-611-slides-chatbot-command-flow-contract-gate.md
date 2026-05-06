Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-611
Title: Slides Chatbot Command-Flow Contract Gate
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a release owner
I want an automated contract gate for Slides chatbot command/flow coverage
So command drift, alias loss, and broken fuzzy routing are blocked before deployment

Acceptance Criteria:
- [x] Contract test validates command and flow id parity for all Slides chatbot actions.
- [x] Contract test enforces minimum fuzzy alias coverage for each Slides command/flow action.
- [x] Contract test verifies discoverability of critical journeys (import, parse, save, html export, pptx export, workspace routing, undo/redo).
- [x] CI contract suite includes this gate in default Slides contract execution.
- [x] Contract failure output is actionable and names the missing command/flow id.

Execution Evidence (2026-04-26):
- Added `tests/contracts/slides-chatbot-contract.test.mjs` with:
  - command-flow id parity assertion
  - alias-depth assertion
  - required journey capability assertion
- Included in default contract suite via existing `tests/contracts/*.test.mjs` script pattern (`npm run test:contracts`).
- Verification status:
  - Passed: `node --test tests/contracts/slides-chatbot-contract.test.mjs`

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
