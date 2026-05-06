Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-061
Title: Add Theme System for Brand-Consistent Deck Styling
Epic: SLD-STRAT-E2 Visual Editing and Canvas UX
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want to apply brand themes and update style tokens globally
So my deck remains visually consistent across slides

Module Scope:
- Primary module: Slides.
- Files in scope: `src/app/slides/page.tsx`, `src/components/slides/types.ts`, `src/components/slides/document.ts`, `tests/e2e/slides-regression.spec.ts`, `tests/contracts/slides-document.contract.test.mjs`.
- Owners: Slides frontend implementation and Slides QA coverage.

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Theme model supports heading/body fonts, primary/secondary/background/accent colors, and spacing scale tokens.
- [x] User can apply a theme to a slide or entire deck.
- [x] Theme updates propagate global style changes across affected slides.
- [x] Non-theme styles remain unchanged unless explicitly converted.
- [x] Imported slides can optionally be converted to theme-linked tokens.

Implementation Evidence:
- `src/components/slides/types.ts`
  - added `SlideTheme`, `SlideThemeRole`, `themeRole`, `themeLinked`, and optional `document.theme` metadata.
- `src/components/slides/document.ts`
  - preserves theme metadata across create/sync/append/duplicate/delete/reorder document flows.
- `src/app/slides/page.tsx`
  - added theme draft state, slide-vs-deck apply scope, optional imported-layer conversion, and theme application controls in the editor panel.

QA / Evidence:
- Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-061 applies brand themes to the current slide or full deck and only converts imported slides when requested" --workers=1`
- Passed: `node --test tests/contracts/slides-document.contract.test.mjs`
- Passed: `npm run typecheck`

Reference Model:

```ts
type Theme = {
  fonts: { heading: string; body: string }
  colors: { primary: string; secondary: string; background: string; accent: string }
  spacingScale: Record<string, number>
}
```

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
