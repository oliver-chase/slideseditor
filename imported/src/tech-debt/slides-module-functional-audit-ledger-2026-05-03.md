# Slides Module Functional Audit Ledger

Last updated: 2026-05-03 (America/New_York)
Scope: `/slides` module runtime behavior, persistence seams, and Supabase traceability
Primary goal: keep one durable ledger of what was audited, what was fixed, and what is still unverified/gapped.

## 1) What Was Audited In This Pass

- `src/app/slides/page.tsx`
- `src/modules/use-module-access.ts`
- `src/app/slides/hooks/use-slides-editor-persistence.ts`
- `src/app/slides/hooks/use-slides-library-data.ts`
- `src/app/slides/hooks/use-slides-html-pdf-export.ts`
- `src/app/slides/hooks/use-slides-import-ingestion.ts`
- `src/app/slides/hooks/use-slides-canvas-interactions.ts`
- `src/lib/slides.ts`
- `functions/api/slides.js`
- `functions/api/slides/route-handler-groups.js`
- `functions/api/slides/get-resource-handlers.js`
- `functions/api/slides/post-core-slide-handlers.js`
- `tests/contracts/slides-decomposition.contract.test.mjs`
- `tests/contracts/slides-api.contract.test.mjs`
- `tests/contracts/slides-runtime-health-policy.contract.test.mjs`

## 2) Defects Fixed In This Pass

### F1. Silent module-access failure made Slides appear dead
- File: `src/modules/use-module-access.ts`, `src/app/slides/page.tsx`
- Issue: access gating could redirect/fail closed without actionable UI feedback.
- Fix: expose and render access-state diagnostics (loading, permission, unresolved user, load error, disabled module).

### F2. Retry action did not recover queued/error/conflict unsaved states
- File: `src/app/slides/hooks/use-slides-editor-persistence.ts`
- Issue: `retrySlidesService` retried only when `saveStatus === 'dirty'`.
- Fix: retry now re-attempts save for `dirty|queued|error|conflict`.

### F3. Library/template/audit stale async responses could overwrite newer state
- File: `src/app/slides/hooks/use-slides-library-data.ts`
- Issue: out-of-order async completion could regress UI state after quick filter/search changes.
- Fix: request sequence guard (`requestSequenceRef`) drops stale responses.

### F4. HTML export had blob URL lifecycle race
- File: `src/app/slides/hooks/use-slides-html-pdf-export.ts`
- Issue: immediate `URL.revokeObjectURL` can cause intermittent empty/failed downloads.
- Fix: hidden-anchor append/remove + deferred revoke (`setTimeout(..., 0)`).

### F5. Import session traces were misclassified as pasted input
- File: `src/app/slides/hooks/use-slides-editor-persistence.ts`, `src/app/slides/hooks/use-slides-import-ingestion.ts`, `src/app/slides/page.tsx`
- Issue: `recordImportSessionTrace` always wrote `source: 'pasted'`.
- Fix: caller-provided source now flows through parse pipeline (`file-picker`, `pasted`, `chat-upload`).

### F6. Import session traces were not durably persisted
- File: `functions/api/slides.js`
- Issue: `record-import-session-trace` used process memory even though `018_slide_import_session_traces.sql` created the Supabase table and RLS policy.
- Fix: POST now inserts into `slide_import_session_traces`; GET `import-session-traces` reads the table with actor scoping.

## 3) New Guardrails Added

- `tests/contracts/slides-decomposition.contract.test.mjs`
  - Retry coverage across `dirty|queued|error|conflict`
  - Stale-response guard presence in library data hook
  - Deferred object URL revoke in HTML export
  - Parse-source signature and non-hardcoded source behavior

## 4) Verification Run Log (This Pass)

- `npm run -s typecheck` -> PASS
- `node --test tests/contracts/slides-decomposition.contract.test.mjs` -> PASS
- `node --test tests/contracts/slides-runtime-health-policy.contract.test.mjs` -> PASS
- `node --test tests/contracts/slides-api.contract.test.mjs` -> PASS
- `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-api-router-decomposition.contract.test.mjs tests/contracts/slides-migration-verification.contract.test.mjs` -> PASS (`20/20`) after import trace persistence and matrix gate updates.
- Browser recertification follow-up:
  - Initial correct-auth browser run: 77/83 passed; failures exposed missing runtime controls for crop, layout constraints, responsive adapt, theme application, PPTX warning report download, and text alignment buttons.
  - Remediation restored those controls and fixed layout/theme metadata equality so non-geometric document metadata changes persist.
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=slides-qa-placeholder PLAYWRIGHT_WEB_SERVER_PORT=3001 npx playwright test tests/e2e/slides-regression.spec.ts tests/e2e/slides-import-large.spec.ts tests/e2e/slides-visual.spec.ts --workers=1` -> PASS (`83/83`).

## 5) Supabase Activity Mapping (For Later Audit Follow-Up)

### API router entrypoint
- `functions/api/slides.js` uses `supabaseFetch(...)` for all persistent module actions/resources.

### GET resources map (read paths)
- Source of truth: `functions/api/slides/route-handler-groups.js`
- `slides`
- `templates`
- `archived-templates`
- `template-collaborators`
- `template-approvals`
- `audit-presets`
- `audit-export-jobs`
- `pptx-export-jobs`
- `telemetry-summary`
- `import-session-traces`
- `audits`

### POST actions map (write/compute paths)
- Source of truth: `functions/api/slides/route-handler-groups.js`
- Slide lifecycle: `save`, `duplicate-slide`, `rename-slide`, `delete-slide`
- Template lifecycle: `duplicate-template`, `publish-template`, `refresh-template-preview`, `update-template`, `archive-template`, `restore-template`, `permanent-delete-template`
- Governance: `transfer-template-owner`, `upsert-template-collaborator`, `remove-template-collaborator`, `submit-template-approval`, `resolve-template-approval`, `escalate-template-approval`, `run-approval-escalation-sweep`
- Audit/export: `upsert-audit-preset`, `delete-audit-preset`, `request-audit-export-job`, `download-audit-export-job`, `record-export`
- PPTX export: `request-pptx-export-job`, `download-pptx-export-job`
- Telemetry: `record-telemetry`, `record-import-session-trace`

### Canonical matrix artifact
- Published matrix: `.github/oliver-app/modules/slides-module/SLIDES-ACTION-TABLE-RLS-MATRIX.md`.
- Update gate: `tests/contracts/slides-api-router-decomposition.contract.test.mjs` checks every active `route-handler-groups.js` GET resource and POST action has a row in the matrix.
- `SLD-QA-627` is closed (`Done` + `Verified`).

### Migration inventory tied to Slides persistence features
- `003_slides_platform.sql`
- `005_slide_audit_filter_indexes.sql`
- `006_slide_template_collaborators.sql`
- `007_slide_template_approvals.sql`
- `008_slide_audit_filter_presets.sql`
- `009_slide_approval_escalations.sql`
- `010_slide_audit_export_jobs.sql`
- `018_slide_import_session_traces.sql`

## 6) Open Risks / Known Gaps (Not Yet Closed)

### G1. Full browser E2E behavior recertified after runtime-control regressions
- Status: Closed on 2026-05-03.
- Evidence: full browser suite passed (`83/83`) after restoring missing crop/layout/theme/PPTX warning report/text alignment controls and metadata persistence.
- Tracking story: `SLD-QA-625` (`Done` + `Verified`).

### G2. Supabase data-quality backfill audit closed with documented no-op rationale
- We fixed trace source attribution going forward and restored durable backend persistence for `record-import-session-trace` into `slide_import_session_traces`.
- A local `supabase projects list` check found one unlinked project (`Ops Dashboard`) and no attributable linked ref for this workspace, so no live project counts or backfill were run here.
- Tracking story: `SLD-QA-626` (`Done` + `Verified`).

### G3. Router/action-to-migration reconciliation documented as row-level contract
- Status: Closed on 2026-05-03.
- Evidence: `.github/oliver-app/modules/slides-module/SLIDES-ACTION-TABLE-RLS-MATRIX.md` plus matrix coverage contract in `tests/contracts/slides-api-router-decomposition.contract.test.mjs`.
- Tracking story: `SLD-QA-627` (`Done` + `Verified`).

## 7) Recommended Next Validation Steps On Main

1. Validate save/retry/degraded recovery manually with network throttling and forced 5xx errors.

## 8) Standing Audit Requirements (Persistent)

These are permanent requirements for Slides audit work and should be assumed in future passes without re-statement:

1. Commit/push/merge scope discipline:
- Only commit work owned by the active Slides audit task.
- Do not include unrelated module edits from parallel chats/agents.
- If merge/promotion conflict occurs, explicitly call it out with exact conflict context.

2. Single-file gap traceability:
- Maintain one canonical ledger file that captures fixed issues, unresolved risks, and unknowns.
- Include explicit Supabase-related gaps in this ledger so follow-up does not require rediscovery.

3. Story system as complete source of truth:
- Keep user-story records synchronized with audit fixes, acceptance criteria, and verification evidence.
- Update outdated story metadata/acceptance criteria when behavior changes.
- Ensure a handoff reader can reconstruct expected frontend behavior, backend actions, and data/telemetry expectations from story + ledger records.

4. Data tracking and documentation completeness:
- Persist audit requirements, data-governance constraints, and traceability expectations in repo docs/stories.
- Capture where coverage is proven vs. where runtime verification remains pending.

## 9) Depth Declaration (Did vs Did Not)

### Completed depth (`Did`)
- Line-level audit + fixes across Slides page orchestration, persistence, library refresh behavior, and export lifecycle.
- Added contract guards to lock in retry-state recovery, stale-response suppression, deferred export cleanup, and parse-source attribution.
- Built single-file Supabase traceability inventory (resources, actions, migrations) with open gaps mapped to `SLD-QA-625/626/627`.
- Restored backend persistence for import session traces and added a canonical action-to-table/RLS matrix with dispatch-map contract enforcement.

### Not completed (`Did Not`)
- Historical Supabase trace backfill/remediation execution.

### Next dig locations
- `tests/e2e/slides-regression.spec.ts` (full browser-capable run).
- Supabase traces + migrations for `slide_import_session_traces`.
