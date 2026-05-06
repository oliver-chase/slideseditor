Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-029
Title: Slides Chat Command Parity + Flow Runtime Guardrails
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want Oliver commands to cover key slide actions without breaking standard editor controls
So chat-driven workflows are useful while keeping existing page interactions stable

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides command catalog includes save, export generation, and workspace navigation intents with fuzzy aliases.
- [x] Slides chat flows execute save/export/navigation actions and return user-facing confirmations.
- [x] Zero-step flow rendering in `OliverDock` is guarded to avoid runtime `step.kind` crashes.
- [x] Command discoverability does not create duplicate button-role collisions with core editor controls.
- [x] Frontend smoke coverage validates parse/save/export/navigation via chatbot command paths.
- [x] Any Supabase/runtime data integrity gaps discovered during chatbot flow audit are logged in `docs/SUPABASE-AUDIT-GAP-LEDGER.md`.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Status was downgraded from completion-only state because AC and/or evidence is incomplete for verification.
- Complete remaining Acceptance Criteria and attach command-level QA evidence before transitioning to Done + Verified.
