Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-063
Title: Export Decks to reveal.js Presentation Format
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to export my deck to reveal.js
So I can publish web-native presentations quickly

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Each slide exports to a reveal.js `<section>`.
- [x] Deck order is preserved in exported structure.
- [x] V1 reveal export mode supports absolute-positioned HTML fidelity.
- [x] Exported deck runs in browser with correct slide transitions.
- [x] Export contract remains JSON-driven from SlideDocument deck data.

Implementation Evidence:
- `src/components/slides/html-export.ts`
  - added `convertSlideDocumentToRevealHtml(...)` to emit a standalone reveal.js deck from canonical `SlideDocument` data.
- `src/app/slides/page.tsx`
  - added generate/download reveal.js export actions and a dedicated reveal export textarea in the editor export controls.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-document.contract.test.mjs`
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-063" --workers=1`
- Repo-wide `npm run typecheck` is currently blocked by unrelated non-Slides errors in `src/components/shared/OliverDock.tsx`.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
