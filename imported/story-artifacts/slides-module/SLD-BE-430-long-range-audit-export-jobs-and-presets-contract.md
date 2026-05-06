Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-430
Title: Long-Range Audit Export Jobs and Presets Contract
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want backend support for saved audit presets and long-range export jobs
So large compliance queries can run asynchronously without blocking UI workflows

Acceptance Criteria:
- [x] Backend persists named filter presets with ownership and sharing policy.
- [x] Export-job API supports asynchronous generation for long date windows and high row counts.
- [x] Job status endpoint reports queued/running/succeeded/failed lifecycle with retry metadata.
- [x] Export artifacts are downloadable via secure expiring links.
- [x] Audit query performance remains bounded under preset and export workloads.

QA / Evidence:
- `functions/api/slides.js`:
  - `handleUpsertAuditPresetAction`/`handleDeleteAuditPresetAction` implement create/update/delete with ownership and shared-scope authorization constraints.
  - `handleRequestAuditExportJobAction` creates job rows, runs bounded audit query path, serializes CSV content, and transitions status to `completed`/`failed`.
  - `handleDownloadAuditExportJobAction` allows download only for completed jobs and enforces actor access to requested records.
  - `onRequestGet` for `audit-export-jobs` filters by `status` and returns role-aware paginated records.
- `src/lib/slides.ts`:
  - Client contract wrappers and types for `upsertAuditPreset`, `deleteAuditPreset`, `listAuditExportJobs`, `requestAuditExportJob`, and `downloadAuditExportJob`.
- `tests/e2e/slides-regression.spec.ts`:
  - `SLD-FE-430 and SLD-BE-430 save, apply, and delete activity filter presets`
  - `SLD-FE-431 and SLD-BE-430 queue filtered audit export jobs and support csv downloads`
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-431 and SLD-BE-430 queue filtered audit export jobs and support csv downloads" --workers=1`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
