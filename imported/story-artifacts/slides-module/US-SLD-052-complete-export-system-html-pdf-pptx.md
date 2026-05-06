Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-052
Title: Complete HTML, PDF, and PPTX Export Pipeline From SlideDocument JSON
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to export slides to HTML, PDF, and PPTX from my edited canvas state
So I can deliver outputs without format-specific rework

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] HTML export generates deterministic absolute-positioned slide markup with inline styles and embedded assets.
- [x] HTML export visually matches canvas rendering within agreed tolerance.
- [x] PDF export is generated from rendered HTML output and preserves layout fidelity.
- [x] PDF export includes no major layout shifts against canvas.
- [x] PPTX export maps text layers to editable text boxes.
- [x] PPTX export maps shape layers to editable PPTX shapes where supported.
- [x] PPTX export maps image/logo layers to image objects.
- [x] Unsupported style mappings (for example complex gradients/shadows) surface explicit warnings.
- [x] All export paths consume canonical SlideDocument JSON as source.

Notes:
- PPTX target is best-effort editability, not guaranteed pixel-perfect parity.

Implementation Evidence:
- Added canonical export helpers in `src/components/slides/html-export.ts` and `src/components/slides/pptx-export.ts` so HTML/PDF/PPTX all derive from `SlideDocument`.
- Updated `src/app/slides/page.tsx` HTML/PDF generation and `src/app/slides/hooks/use-slides-pptx-export.ts` PPTX flows to sync and export canonical documents rather than loose canvas/component snapshots.
- Extended PPTX job request handling in `src/lib/slides.ts` and `functions/api/slides.js` so server-side warning/native-object projection can consume canonical `slide_document` payloads.

QA Evidence:
- `npm run typecheck`
- `node --test tests/contracts/slides-document.contract.test.mjs tests/contracts/slides-api.contract.test.mjs`
- `npx playwright test tests/e2e/frontend-smoke.spec.ts -g "US-SLD-052 slides PDF export prints canonical SlideDocument HTML|US-SLD-040 slides chatbot can download HTML export directly without dead-end follow-up"`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings|SLD-FE-500 exports selected My Slides rows to one PPTX and records export-pptx activity"`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
