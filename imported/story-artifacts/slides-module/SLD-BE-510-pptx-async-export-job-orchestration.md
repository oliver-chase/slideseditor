Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-510
Title: PPTX Async Export Job Orchestration
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want asynchronous orchestration for larger PPTX export workloads
So multi-slide or heavy export requests stay reliable under production load

Acceptance Criteria:
- [x] PPTX export jobs support queued/running/succeeded/failed lifecycle states.
- [x] Job payload includes selected slide ids, requester identity, and generation options.
- [x] Retry policy is bounded and idempotent for transient generation/storage failures.
- [x] Completed jobs expose downloadable artifact metadata and expiration policy.
- [x] Job lifecycle events are queryable for operational and compliance diagnostics.

Evidence:
- Job lifecycle + payload contract implemented in `/functions/api/slides.js` (`handleRequestPptxExportJobAction`, `handleDownloadPptxExportJobAction`, `resource=pptx-export-jobs`).
- Client-side API wrappers and local parity model implemented in `/src/lib/slides.ts` (`requestPptxExportJob`, `downloadPptxExportJob`, `listPptxExportJobs`).
- Export UI now orchestrates through job API before artifact download in `/src/app/slides/page.tsx`.
- Contract checks in `/tests/contracts/slides-pptx-export.contract.test.mjs` validate request, list, and download paths.

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.
