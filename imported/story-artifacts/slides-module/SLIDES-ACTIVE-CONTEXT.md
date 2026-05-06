# Slides Active Context

Last Updated: 2026-04-30
Owner: Codex execution stream
Scope: Slides-only product/build/QA workflow

## Current Objective

Normalize Slides planning artifacts so strategy, backlog ordering, and story files are one coherent system with no missing IDs, no stale in-progress state, and no dead references.

## In-Flight Workstream

1. Canonical strategy parity:
- `US-SLD-101..153` strategy IDs now have concrete story files.
2. Import reliability hardening:
- `US-SLD-158` completed to remove upload no-op behaviors and add parse diagnostics.
3. Backend observability hardening queued:
- `US-SLD-159` planned for import traceability and migration-verification automation.
4. Backlog/source cleanup:
- Remove references to missing QA docs.
- Remove stale "In Progress" labels for completed `SLD-FE-620` and `SLD-BE-620`.
5. Ordering/epic normalization:
- Align execution logs and backlog index to strategy epics/waves.

## Non-Negotiable Execution Rules

1. No story marked `Done` without AC checkboxes completed and explicit test evidence.
2. Any new UI control requires:
- interaction inventory mapping
- click-path test reference
- failure/denied-state validation.
3. Keep all Slides planning changes synchronized in same commit across:
- `SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- `src/tech-debt/slides-backlog.md`
- `.github/user-stories/oliver-app/backlog/slides-module/README.md`
- relevant story files.

## Immediate Next Actions

1. Finish epic-by-epic ordering and status mapping between legacy `SLD-*` delivery stories and canonical `US-SLD-101..153`.
2. Remove remaining duplicate planning prose where strategy already defines the source truth.
3. Keep QA gates green (`typecheck`, `check-stories`, `slides-*` contracts) after each cleanup change.
