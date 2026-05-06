# Slides Backlog

Last Updated: 2026-04-30
Scope: `/slides` only

## Canonical Sources

1. `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
2. `/.github/oliver-app/modules/slides-module/SLIDES-ACTIVE-CONTEXT.md`
3. `/.github/oliver-app/modules/slides-module/GAP-REGISTER.md`
4. `/.github/oliver-app/modules/slides-module/*.md` story files

## Current State

1. Feature execution stories are complete in the existing `US-SLD-*`, `SLD-*`, and `SLD-QA-*` delivery set.
2. Strategy normalization and epic-mapping governance work are complete.
3. Decomposition completion stories are done:
- `SLD-FE-620`
- `SLD-BE-620`
- `US-SLD-159`

## Open Planning Work (Documentation + Ordering)

No additional Slides planning-only work is currently open.

## Truthful Current Action State

The active remediation state is tracked in `src/tech-debt/slides-qa-audit-status.md`.

Current execution state:
- `US-SLD-090` is completed and verified in the audit status file.
- `SLD-QA-620`, `SLD-QA-621`, `SLD-QA-622`, and `SLD-TECH-630` are completed audit/remediation tickets.
- The remaining active remediation work is decomposition-focused:
  - `SLD-FE-620`
  - `SLD-BE-620`

Do not read this backlog as meaning the Slides module has no remaining active remediation work. This file is the planning/order ledger, not the execution-state ledger.

## Gate Commands

1. `npm run typecheck`
2. `npm run check-stories`
3. `npm run test:contracts -- slides- --runInBand`
