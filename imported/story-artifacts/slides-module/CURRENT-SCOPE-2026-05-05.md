# Slides Current Scope - 2026-05-05

## Current product scope

Slides is currently scoped around the import/edit/save/export workflow:

- import or paste HTML into an editable slide/deck workspace
- edit slide/deck canvas content
- save/load slides through My Slides
- publish simple templates from saved slides
- preview and duplicate templates
- export HTML/PDF/PPTX
- preserve PPTX export warning/report behavior
- preserve backend PPTX job orchestration where documented

## Current core PPTX contract

PPTX export remains core. Do not remove it.

The expected PPTX workflow is:

- export the current working slide/deck
- export selected saved slides from My Slides
- call the backend PPTX job contract where wired
- surface backend/native projection warnings in the UI
- preserve the warning report download
- preserve export audit behavior
- fall back safely when fidelity is reduced

## Removed from current frontend/backend scope

The following governance/audit/telemetry surfaces were intentionally removed from the current active app scope during the May 2026 simplification pass:

- Slides audit UI/actions/state hooks
- Slides audit telemetry frontend surfaces
- unsaved-change telemetry client helper
- template approval queue UI
- approval SLA/escalation UI
- template collaborator management UI
- template ownership transfer UI
- template archive/restore/permanent delete UI
- template governance backend remnants in the frontend data client

These removed surfaces may still appear in historical Done/Verified story files, QA ledgers, or RLS matrices. Treat those references as historical unless a new product decision explicitly reactivates them.

## Documentation warning

Historical files in this module may still reference governance, audit, telemetry, approval queues, archived templates, and collaborator workflows. Do not re-add those code paths solely because historical story files mention them.

Before restoring any removed governance/audit/telemetry behavior, create a new story that defines the current product need, UI entry point, backend contract, validation plan, and migration impact.

## Safe cleanup rule

Do not delete code only because it is large.

Before deleting or rewriting:

1. Check this current scope note.
2. Check live references in `src/app/slides`, `src/components/slides`, and `src/lib/slides.ts`.
3. Check the relevant story files.
4. Classify the code as current core, useful but overbuilt, stale compatibility, historical/removed, or truly dead.
5. Validate with typecheck and build.
