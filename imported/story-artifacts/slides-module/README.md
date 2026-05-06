# Slides Module

Use these files as the canonical entrypoints:

- [Strategy + canonical execution backlog](./SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md)
- [Active execution context](./SLIDES-ACTIVE-CONTEXT.md)
- [Execution status / audit handoff](../../../../src/tech-debt/slides-qa-audit-status.md)
- [Functional audit ledger (2026-05-03)](../../../../src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md)
- [Slides action-to-table and RLS matrix](./SLIDES-ACTION-TABLE-RLS-MATRIX.md)
- [Global Supabase audit gap ledger](../../../../docs/SUPABASE-AUDIT-GAP-LEDGER.md)
- [Backlog root](../../../user-stories/oliver-app/backlog/slides-module/README.md)
- [Execution queue](../../../../src/tech-debt/slides-backlog.md)
- [Gap register](./GAP-REGISTER.md)
- [Interaction inventory](./SLIDES-INTERACTION-INVENTORY.json)
- [Archived functionality index](./archive/ACTIVITY-WORKSPACE-ARCHIVE.md)

The active strategy and canonical execution plan lives in `SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`.
The backlog root in `.github/user-stories/oliver-app/backlog/slides-module/README.md` should index to that strategy document.
Detailed execution ordering in `src/tech-debt/slides-backlog.md` must remain synchronized with the canonical strategy backlog.
The execution-state handoff lives in `src/tech-debt/slides-qa-audit-status.md` and should be treated as the current active work ledger.
Story files in this module folder are the source of truth for acceptance criteria and evidence.
Unresolved Slides data/persistence risks must be logged in `docs/SUPABASE-AUDIT-GAP-LEDGER.md` before story closure.
Standing audit policy:
- Log unresolved data/persistence risks in the global Supabase ledger before marking stories Done + Verified.

## Current scope note

The current active Slides scope is documented in `CURRENT-SCOPE-2026-05-05.md`. Treat that file as the current scope override when historical Done/Verified stories mention removed governance, audit, telemetry, approval queue, collaborator, or archived-template workflows.


## Decomposition Ownership Map

- FE orchestrator surface: `src/app/slides/page.tsx` (composition + render orchestration only)
- FE helper orchestration: `src/app/slides/helpers/page-orchestrator-utils.ts` (theme/template ranking + preview orchestration helpers)
- FE bounded hooks:
  - import: `src/app/slides/hooks/use-slides-import-ingestion.ts`
  - deck/editor interactions: `src/app/slides/hooks/use-slides-canvas-interactions.ts`
  - editor persistence: `src/app/slides/hooks/use-slides-editor-persistence.ts`
  - export: `src/app/slides/hooks/use-slides-html-pdf-export.ts`, `src/app/slides/hooks/use-slides-pptx-export.ts`
  - governance/audit: `src/app/slides/hooks/use-slides-template-governance.ts`, `src/app/slides/hooks/use-slides-audit-actions.ts`, `src/app/slides/hooks/use-slides-audit-state.ts`
- BE route dispatch entrypoint: `functions/api/slides.js`
- BE route concern grouping: `functions/api/slides/route-handler-groups.js` (`slides/templates/governance/audit/export/telemetry`)
