Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-500
Title: PPTX Export UX (Single and Multi-Slide)
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to export one or multiple slides to PPTX from the module
So I can deliver editable decks without leaving the slides workflow

Acceptance Criteria:
- [x] Import workspace supports single-slide PPTX export for the active slide.
- [x] My Slides supports multi-select export controls with clear selected-count state.
- [x] Export flow surfaces warnings report for unsupported component mappings.
- [x] Success/failure states are actionable and write audit events for PPTX exports.
- [x] Chat command coverage includes PPTX export initiation without dead-end follow-up.

Evidence:
- Single-slide current export, warning surfacing, and download behavior are validated by `tests/e2e/slides-regression.spec.ts` (`SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings`).
- Multi-select My Slides export with selected-count button state and `export-pptx` activity recording is validated by `tests/e2e/slides-regression.spec.ts` (`SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity`).
- Export orchestration now calls backend PPTX job contract before artifact download (`requestPptxExportJob` / `downloadPptxExportJob`) and merges backend warnings into UI report in `src/app/slides/page.tsx` (`runPptxExport`).

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.
