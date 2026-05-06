Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-157
Title: Expert visual design quality gate
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a user
I want Slides UI states to feel clean, intentional, and reliable
So I can complete editing/export tasks quickly without confusion or visual friction

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Visual hierarchy is explicit for all core states: import empty, parse result, editing, export, activity/degraded.
- [x] Primary/secondary/destructive actions are consistently styled with design-system tokens and spacing scale.
- [x] No critical control overlap or hidden controls on desktop and mobile breakpoints.
- [x] Empty/loading/error/degraded states use production-grade copy/layout (no placeholder-only blocks).
- [x] Any intentional visual deviation from shared module patterns is documented with rationale.

Required Tests:
- [x] Visual regression snapshots for core states on desktop.
- [x] Mobile click-path and overflow assertions for control discoverability.
- [x] Contract/token checks ensuring no off-system raw style values in Slides module styles.
- [x] E2E assertions for disabled/denied states on primary actions (save/export/publish/approve).

Implementation Notes:
- Quality contract source of truth: `SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md` section `4.2`.
- Existing evidence stories (`SLD-FE-616`, `SLD-QA-612`, `SLD-QA-614`) are baseline inputs; this story closes remaining quality-gate gaps.

QA / Evidence:
- `node --test tests/contracts/slides-visual-quality-gate.contract.test.mjs`
- `node --test tests/contracts/slides-runtime-health-policy.contract.test.mjs`
- `PLAYWRIGHT_WEB_SERVER_PORT=3001 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy-key npx playwright test tests/e2e/slides-visual.spec.ts tests/e2e/mobile-clickpaths.spec.ts -g "canvas baseline render is stable|slides workspace tabs and chatbot flows remain mobile-safe" --workers=1`

Test Plan:
- Positive path: visual quality contract and desktop visual snapshots verify core Slides UI states remain covered.
- Negative path: runtime health policy contract verifies degraded/fallback state handling remains explicit.
- Regression path: mobile click-path and overflow assertions protect discoverability and control layout at constrained breakpoints.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after command-level QA evidence and governance checks were revalidated.
