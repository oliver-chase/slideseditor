Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-156
Title: Frontend interaction inventory and click-path enforcement
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a product owner
I want every Slides button/click/keyboard path mapped to frontend handlers and backend contracts
So no user action is undefined, broken, or untested in release workflows

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Canonical interaction inventory includes all user-triggerable controls across Import, Editor, Canvas, Save/Governance, Export, and shell navigation.
- [x] Each inventory entry maps:
  - control id / label
  - frontend handler/function
  - backend endpoint/action (or explicit `frontend-only`)
  - expected success state
  - expected failure/denied state
- [x] Primary controls have keyboard path assertions (`Enter`/`Space`/tab order) where applicable.
- [x] Adding/removing controls requires inventory update in same PR.

Required Tests:
- [x] E2E: import controls click paths (happy + validation failure + cancel).
- [x] E2E: editor controls click paths (select/drag/resize/group/undo/redo + lock denied state).
- [x] E2E: export controls click paths (current/selected/warning report + failure path).
- [x] E2E: governance controls click paths (permission granted/denied flows).
- [x] Contract: inventory coverage check that all listed controls reference at least one active test id.

Implementation Notes:
- Inventory source of truth: `SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md` section `4.1`.
- Existing journey matrix stories (`SLD-QA-613`, `SLD-QA-614`) provide base evidence; this story makes the mapping exhaustive and release-gated.
- Implementation artifact: `SLIDES-INTERACTION-INVENTORY.json`.

QA / Evidence:
- `node --test tests/contracts/slides-interaction-inventory.contract.test.mjs`
- `PLAYWRIGHT_WEB_SERVER_PORT=3001 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy-key npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-031 and US-SLD-032 save workflow populates My Slides and template duplication|SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings" --workers=1`

Test Plan:
- Positive path: interaction inventory contract validates all mapped controls reference active test coverage.
- Negative path: inventory contract fails when a mapped test reference is missing or stale.
- Regression path: focused Slides regression click-path tests exercise save/template and PPTX export controls against the inventory.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after command-level QA evidence and governance checks were revalidated.
