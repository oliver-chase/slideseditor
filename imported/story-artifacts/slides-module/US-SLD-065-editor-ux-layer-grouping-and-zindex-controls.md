Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-065
Title: Improve Editor UX for Layer Selection, Grouping, and Ordering
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want cleaner layer operations and keyboard-first controls
So editing feels like a design tool instead of manual DOM management

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Selection behavior is predictable and clear in dense layer scenarios.
- [x] Group and ungroup actions are supported.
- [x] Z-index ordering controls are available and stable.
- [x] Keyboard shortcuts cover primary layer operations.
- [x] Layers panel reflects grouping and structural hierarchy correctly.

Implementation Evidence:
- `src/components/slides/types.ts`
  - added lightweight group metadata on slide components.
- `src/components/slides/document.ts`
  - preserves grouping metadata through canonical document cloning/sync flows.
- `src/app/slides/page.tsx`
  - added group/ungroup toolbar actions, keyboard shortcut help, and a layers panel that reflects grouped hierarchy.
- `src/app/slides/hooks/use-slides-canvas-interactions.ts`
  - added `Ctrl/Cmd+G` and `Shift+Ctrl/Cmd+G` keyboard-first grouping hooks.

QA / Evidence:
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-065" --workers=1`
- Passed: `npm run typecheck`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
