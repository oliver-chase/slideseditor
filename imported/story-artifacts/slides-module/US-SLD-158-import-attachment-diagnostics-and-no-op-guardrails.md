Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-158
Title: Import attachment diagnostics and no-op guardrails
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user
I want HTML attachment imports to always produce visible parse outcomes with diagnostics
So uploads never appear to do nothing and I can recover quickly from invalid source structures

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Oliver chat attachment upload supports `.html` and `.htm` and routes imported markup into Slides Import workspace.
- [x] Import runs surface diagnostics for source, file metadata, parse duration, component count, warning count, and last error.
- [x] Non-positioned HTML imports no longer dead-end with silent failure patterns.
- [x] Parse failure/cancel/preflight states update diagnostics consistently.

Required Tests:
- [x] E2E: non-positioned HTML parse path never dead-ends with zero actionable feedback.
- [x] E2E: preflight invalid/empty parse path still surfaces explicit failure state.
- [x] Typecheck and story structure gates remain passing after import instrumentation.

Implementation Notes:
- Updated `src/app/slides/page.tsx` to wire Oliver upload parse into workspace import flow and expose diagnostics panel state.
- Updated `src/app/slides/hooks/use-slides-editor-persistence.ts` to emit parse lifecycle diagnostics across start/success/fail/cancel.
- Updated `src/app/slides/hooks/use-slides-import-ingestion.ts` to register file-source metadata into diagnostics.

QA / Evidence:
- `npm run typecheck`
- `npm run check-stories`
- `PLAYWRIGHT_WEB_SERVER_PORT=3001 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy-key npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-104 non-positioned html import never dead-ends with zero editable layers|US-SLD-010 preflight validation blocks empty and recovers on next parse" --workers=1`

Test Plan:
- Regression path: verify attachment upload, preflight failure, and non-positioned import diagnostics through the targeted Slides e2e coverage before treating the story as Done+Verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
