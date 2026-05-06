Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-615
Title: Slides Chatbot Edit and Workspace Flow Parity
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a slide editor user
I want chatbot coverage for core editing and workspace navigation actions
So I can execute critical slides tasks with fuzzy commands without getting stuck in dead-end paths

Acceptance Criteria:
- [x] Slides chatbot command/flow surface includes workspace open actions for Import, My Slides, Template Library, and Activity.
- [x] Slides chatbot command/flow surface includes core edit reversibility actions (`undo`, `redo`) with deterministic user feedback.
- [x] Fuzzy aliases for the above actions include intent-like language (for example: "open editor", "undo edit", "reapply last change").
- [x] Chatbot edit actions include selection-sensitive guidance when no valid target exists (for example align/distribute without multi-select).
- [x] Chatbot action coverage extends to key layer-edit controls (at minimum align/distribute and lock/unlock) with safe-guarded failure messaging.
- [x] Chatbot quick-action discoverability remains usable on mobile layouts and does not obstruct primary editor controls.

Execution Evidence (2026-04-26):
- Added new Slides commands in `src/app/slides/commands.ts`:
  - `slides-open-import`
  - `slides-undo`
  - `slides-redo`
  - `slides-align-selection`
  - `slides-distribute-selection`
  - `slides-lock-selection`
  - `slides-unlock-selection`
- Added matching flow support in `src/app/slides/flows.ts` for:
  - Import workspace routing
  - Undo/redo edit invocation
  - Alignment and distribution choices
  - Lock/unlock selection actions
- Wired page runtime handlers in `src/app/slides/page.tsx`:
  - command switch support for new ids
  - flow context callbacks for `undoEdit`, `redoEdit`, `alignSelection`, `distributeSelection`, and `setSelectionLocked`
- Added mobile discoverability/overlap coverage in `tests/e2e/mobile-clickpaths.spec.ts`:
  - validates visible chatbot command suggestions on mobile
  - validates suggestions do not overlap primary Slides import heading controls
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test --config=playwright.mobile.config.ts tests/e2e/mobile-clickpaths.spec.ts -g "slides workspace tabs and chatbot flows remain mobile-safe" --workers=1`
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
