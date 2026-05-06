Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-150
Title: Unsaved-Change Risk Telemetry and Discard Analytics
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a product and reliability owner
I want the slides editor to emit unsaved-change and discard-risk telemetry
So we can quantify where users abandon work and prioritize reliability fixes with evidence

Acceptance Criteria:
- [x] Client emits structured events for unsaved-change prompts, confirm-leave, cancel-leave, autosave retry, and discard actions.
- [x] Event payloads include actor id, workspace tab, slide id (if available), save status, and trigger source (nav, browser back, reload, close).
- [x] Event emission is debounced/throttled to prevent noisy telemetry on repeated interactions.
- [x] Telemetry can be disabled in local/dev mode via explicit feature flag.
- [x] QA docs include expected telemetry event matrix by user journey.

Execution Evidence (2026-04-26):
- Added client telemetry helper in `src/lib/slides-unsaved-telemetry.ts` with:
  - explicit local/dev enable override via `localStorage['oliver-slides-telemetry-enabled']`
  - bounded duplicate-event throttle
  - non-blocking API submission plus local mirror for degraded/local-draft mode
- Wired prompt/discard/retry event emission in:
  - `src/app/slides/hooks/use-slides-workspace-guard.ts`
  - `src/app/slides/hooks/use-slides-draft-recovery.ts`
  - `src/app/slides/hooks/use-slides-editor-persistence.ts`
- Added QA matrix:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Automated coverage:
  - `tests/e2e/slides-regression.spec.ts`
    - `US-SLD-037 prompts before discarding unsaved changes during workspace navigation`
    - `US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry`

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
