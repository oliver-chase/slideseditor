Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-500
Title: PPTX Native Object Generation Service
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want backend PPTX generation that maps slide components to native PowerPoint objects
So exported decks remain editable and consistent with the source canvas

Acceptance Criteria:
- [x] Export contract maps supported slide component types to native PPTX text/shape objects.
- [x] Unsupported component types degrade gracefully with explicit warnings payload.
- [x] Export response includes warnings summary used by FE warnings report.
- [x] Export path enforces slide ownership/visibility permissions and row-level ACL.
- [x] PPTX export actions are captured in `slide_audit_events` with outcome status.

Evidence:
- API contract now exposes native projection + warnings via `request-pptx-export-job` and download retrieval via `download-pptx-export-job` in `/functions/api/slides.js`.
- Frontend export flow consumes backend warnings metadata before download in `/src/app/slides/page.tsx` (`runPptxExport`).
- Contract coverage added in `/tests/contracts/slides-pptx-export.contract.test.mjs`:
  - `request-pptx-export-job returns succeeded job payload with warnings summary`
  - `pptx-export-jobs listing and download enforce actor access`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.
