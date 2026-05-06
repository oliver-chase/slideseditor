Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-060
Title: Introduce Template System for Reusable Structured Slides
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to save and reuse slide templates with structural controls
So I can create consistent decks faster without breaking layout intent

Module Scope:
- Primary module: Slides.
- Files in scope: `src/app/slides/page.tsx`, `src/components/slides/document.ts`, `src/components/slides/persistence-types.ts`, `src/app/slides/hooks/*`, `tests/e2e/slides-regression.spec.ts`, `tests/contracts/*slides*`.
- Owners: Slides frontend implementation and Slides QA coverage.

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] User can save imported slides and edited slides as templates.
- [x] User can apply a template to create a new slide instance.
- [x] User can duplicate templates.
- [x] Team template sharing workflow is supported.
- [x] Template model supports locked elements and editable zones.
- [x] Locked elements cannot be structurally modified in derived slides.
- [x] Editable zones support text and image replacement while preserving structure.
- [x] Reusable layout blocks are supported for rapid composition.

QA / Evidence:
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-060" --workers=1`
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-400 and SLD-BE-400|SLD-FE-400 restricts shared-template publishing controls for non-admin users" --workers=1`
- `node --test tests/contracts/slides-api.contract.test.mjs`
- Verified dedicated regression coverage for publish-template structure, duplicate-to-slide metadata carryover, and locked-versus-editable behavior on derived slides in `tests/e2e/slides-regression.spec.ts`.
- Verified contract coverage for template publish metadata and duplicate-template structural metadata in `tests/contracts/slides-api.contract.test.mjs`.

Reference Model:

```ts
type Template = {
  id: string
  baseSlide: Slide
  lockedElements?: string[]
  editableZones?: string[]
}
```

Progress Notes (2026-04-27):
- Promoted to `Done` after dedicated template publish/duplicate regression evidence and contract verification were recorded.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
