Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-615
Title: Slides Chatbot Fuzzy Matching and Cross Module Path Guards
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a chatbot operator
I want fuzzy intent matching and module routing guardrails validated for Slides
So prompts resolve accurately without leaking Campaign-specific semantics into Slide Editor flows

Acceptance Criteria:
- [x] Fuzzy intent test corpus includes common user phrasing variants, misspellings, and shorthand for Slides actions.
- [x] Collision checks ensure Campaign-specific GTM/Marketing terms do not route to Slides commands unless explicitly scoped.
- [x] Slides path guards confirm route-safe responses for out-of-scope asks with deterministic remediation prompts.
- [x] Command alias coverage map is audited against live flow ids and includes confidence thresholds for ambiguity handling.
- [x] E2E chat journeys validate both successful action execution and safe fallback guidance for ambiguous intents.

Execution Evidence (2026-04-26):
- Added chatbot scope/collision contract checks:
  - `tests/contracts/slides-chatbot-scope.contract.test.mjs`
- Added e2e scope-guard assertion from Slides route:
  - `tests/e2e/frontend-smoke.spec.ts` (`slides chatbot blocks campaign-scope prompts and keeps Slide Editor scope label`)
- Added deterministic ambiguous-intent guidance handling for generic commands in `src/components/shared/OliverDock.tsx`.
- Added e2e ambiguity + recovery assertion:
  - `tests/e2e/frontend-smoke.spec.ts` (`slides chatbot ambiguous intent shows guidance and supports suggestion-based recovery`)
- Verification status:
  - Passed: `node --test tests/contracts/slides-chatbot-scope.contract.test.mjs tests/contracts/slides-chatbot-contract.test.mjs`
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/frontend-smoke.spec.ts -g "slides chatbot blocks campaign-scope prompts|slides chatbot ambiguous intent" --workers=1`

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
