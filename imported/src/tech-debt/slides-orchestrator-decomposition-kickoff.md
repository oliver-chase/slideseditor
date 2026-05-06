# SLD-FE-610: Slides page orchestrator decomposition (Kickoff)

Date: 2026-04-26

Goal: Reduce risk and coupling in `src/app/slides/page.tsx` by extracting bounded modules one slice at a time.

## Initial slice (started)

- Extract PPTX export selection + action handlers into a dedicated hook/module:
  - Selection logic
    - visible selections
    - hidden-selection warnings
    - bulk actions: select-visible, keep-visible-only, clear-selection
  - Export action plumbing for current-slide export and selected-slide export
  - Busy/notifier state ownership for PPTX operations

## Current work completed

- `src/app/slides/page.tsx`
  - Added explicit hidden-selection handling action: **Keep Visible Only**
  - Keeps existing behavior and action labels intact for current PPTX workflows.
- `src/app/slides/hooks/use-slides-pptx-selection.ts`
  - Owns visible/hidden selection counts and selection mutations.
- `src/app/slides/hooks/use-slides-pptx-export.ts`
  - Owns PPTX export busy/warning state plus current-slide and selected-slide export handlers.
  - Handles hidden-selection hydration, backend job orchestration, local PPTX fallback generation, and export failure audit recording.
- `src/app/slides/hooks/use-slides-audit-state.ts`
  - Owns activity workspace filters, pagination state, preset selection lifecycle, and reset/apply handlers.
- `src/app/slides/hooks/use-slides-audit-actions.ts`
  - Owns activity workspace async actions (preset save/delete, export job queue/download, current-view csv export) and busy flags.
- `src/app/slides/hooks/use-slides-template-governance.ts`
  - Owns template governance state/actions (publish, visibility toggle, collaborator panel/upsert/remove, ownership transfer, archive, approval resolve/escalate, escalation sweep, preview refresh metadata).
- `src/app/slides/hooks/use-slides-editor-persistence.ts`
  - Owns parse lifecycle + save/autosave orchestration (parse preflight/progress/cancel, save conflict handling, retry/backoff queue, degraded local-draft fallback, retry-now/dismiss helpers).
- `src/app/slides/hooks/use-slides-canvas-interactions.ts`
  - Owns canvas interaction + history handlers (layer select, inline edit focus, undo/redo, reorder, keyboard move/resize shortcuts, drag/resize pointer handlers, snap-guide updates).
- `src/app/slides/hooks/use-slides-editor-toolbar-mutations.ts`
  - Owns toolbar mutation handlers (style patching, bounds inspector updates, align, distribute) while preserving lock guards + history behavior.
- `src/app/slides/hooks/use-slides-workspace-guard.ts`
  - Owns unsaved-change navigation safeguards (workspace tab switch, back-to-hub, browser unload, popstate bounce protection).
- `src/app/slides/hooks/use-slides-draft-recovery.ts`
  - Owns draft snapshot lifecycle (load scoped/legacy draft, persist dirty snapshot, restore/discard handlers, canvas transient reset during restore).
- `src/app/slides/hooks/use-slides-library-data.ts`
  - Owns library refresh/loading/error orchestration (slides/templates/approvals/audits/presets/export jobs) including initial allow-render fetch side effect.
- `src/app/slides/hooks/use-slides-import-ingestion.ts`
  - Owns import-file intake orchestration (file selection, preflight validation, companion stylesheet inlining, warning synthesis, parse kickoff, picker trigger).
- `src/app/slides/hooks/use-slides-html-pdf-export.ts`
  - Owns HTML/PDF export orchestration (artifact download, export audit recording, refresh-on-completion, and PDF fallback failure handling).
- `src/app/slides/page.tsx`
  - Removed inlined PPTX export + HTML/PDF export + activity/template-governance + parser/save/autosave + canvas interaction + toolbar mutation + workspace guard + draft-recovery + library refresh + import intake orchestration blocks and now composes bounded hooks.
  - Preserves existing button labels, warning rendering, and export-path behaviors.

## QA and Regression Gate (2026-04-26)

- Contract tests (pass):
  - `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs`
- E2E regression tests for changed slices (pass):
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-210|SLD-FE-400|SLD-FE-410|SLD-FE-440"`
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-420|SLD-FE-430|SLD-FE-431|SLD-FE-501"`
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-500 exports current slide|SLD-FE-500 exports selected My Slides rows"`
- Full Slides regression sweep (pass):
  - `npx playwright test tests/e2e/slides-regression.spec.ts`
  - 48 passed (1.7m)
- Type safety gate (pass):
  - `npx --no-install tsc --noEmit --pretty false`
- Extended e2e assertion shipped:
  - `SLD-FE-501` now asserts **Keep Visible Only** trims hidden selections and updates export count.

## Gap Analysis (remaining to close SLD-FE-610)

1. `src/app/slides/page.tsx` remains large (~5k+ lines) despite decomposition progress because render markup and remaining page-level wiring are still co-located.
2. Final closure for `SLD-FE-610` is now centered on regression-gate reruns and any follow-up boundary polishing from test findings.

## Slice 1 acceptance criteria

- Current PPTX export behavior unchanged for existing tests:
  - `Export Selected PPTX (n)` button still reflects selected count.
  - Hidden selections continue to be included by loading complete slide set when needed.
- New action available to trim selection to currently visible list.
- No behavior regressions in:
  - `handleExportCurrentAsPptx`
  - `handleExportSelectedSlidesAsPptx`
  - `setPptxSelectedSlideIds` lifecycle

## Next implementation plan

1. Re-run full Slides regression + visual gate after final decomposition slices.
2. Codify full Slides e2e gate command in epic QA checklist (48-case regression sweep).
