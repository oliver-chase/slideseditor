Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-624
Title: Close out slides functional audit with runtime hardening and single-file ledger traceability
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a Slides maintainer
I want the latest runtime hardening fixes and audit findings captured in one canonical ledger and story record
So we can validate on main and revisit Supabase-related gaps without rediscovery work.

Acceptance Criteria:
- [x] Slides access gating no longer fails silently; `/slides` surfaces explicit access-state diagnostics for disabled/loading/error/no-access outcomes.
- [x] Retry recovery path re-attempts save from unsaved failure states (`dirty`, `queued`, `error`, `conflict`) instead of `dirty` only.
- [x] Library/template/audit async refresh flow ignores stale responses and only applies the newest request results.
- [x] HTML export download lifecycle uses deferred object URL cleanup to avoid intermittent empty/failed file downloads.
- [x] Import-session trace source attribution is caller-provided and correctly distinguishes `file-picker`, `pasted`, and `chat-upload` ingestion paths.
- [x] A single consolidated ledger exists and is committed, documenting audited surfaces, fixed defects, open risks, Supabase action/resource mapping, and migration inventory.
- [x] Standing audit requirements (scope discipline, conflict callout, Supabase gap traceability, and story/documentation completeness) are persisted in the ledger for reuse in future passes.
- [x] Cross-module Supabase traceability handoff points to the canonical global ledger `docs/SUPABASE-AUDIT-GAP-LEDGER.md`.

Scope / Owners:
- Primary module: Slides
- Files in scope:
  - `src/modules/use-module-access.ts`
  - `src/app/slides/page.tsx`
  - `src/app/slides/hooks/use-slides-editor-persistence.ts`
  - `src/app/slides/hooks/use-slides-library-data.ts`
  - `src/app/slides/hooks/use-slides-html-pdf-export.ts`
  - `src/app/slides/hooks/use-slides-import-ingestion.ts`
  - `tests/contracts/slides-decomposition.contract.test.mjs`
  - `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`
- Owners:
  - Slides runtime owner
  - Slides QA/governance owner

QA / Evidence:
- Executed commands:
  - `npm run -s typecheck`
  - `node --test tests/contracts/slides-decomposition.contract.test.mjs tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-runtime-health-policy.contract.test.mjs`
- Results:
  - Typecheck passed.
  - Slides contract suite subset passed (`23/23` in the latest run).
  - Review-found telemetry-source regression in chatbot parse path was corrected before closeout (`runParseWithProgress(rawHtml, 'pasted')`).
- Artifacts:
  - Consolidated ledger: `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`
  - Cross-module gap ledger: `docs/SUPABASE-AUDIT-GAP-LEDGER.md`

Test Plan:
- Positive path: parse, save/retry, library refresh, and export operations work without stale-state or dead-end retry behavior.
- Negative path: failed/queued/conflict states still support deterministic retry and degraded-mode recovery.
- Regression path: decomposition contracts enforce new guardrails for retry-state coverage, stale-response blocking, deferred export cleanup, and parse-source attribution.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
