Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-210
Title: Template Preview Assets and Indexing Contract
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want persisted template preview assets with queryable metadata
So template libraries can serve visual selection quickly and reliably

Acceptance Criteria:
- [x] Template record contract includes preview asset reference and freshness metadata.
- [x] Backend generates and stores preview snapshots on publish/update operations.
- [x] Query responses include preview URLs/keys with cache-safe invalidation semantics.
- [x] Visibility rules apply to preview assets consistently with template ACL.
- [x] Missing/stale preview regeneration path is available for owner/admin actions.

Implementation Evidence (2026-04-26):
- `functions/api/slides.js`
  - normalizes persisted preview metadata onto template responses
  - generates preview snapshot metadata on publish
  - exposes `refresh-template-preview` owner/admin action with versioned asset references
- `src/lib/slides.ts`
  - persists preview metadata in local fallback mode
  - exposes `refreshTemplatePreview(...)` client helper
- `src/components/slides/persistence-types.ts`
  - adds typed preview contract on `SlideTemplateRecord`

QA / Evidence (2026-04-26):
- `npm run typecheck`
- `node --test tests/contracts/slides-api.contract.test.mjs`
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-210 template search ranks best matches and quick preview supports duplicate flow"`

QA / Evidence:
- Backfilled by `SLD-QA-620` lifecycle audit on 2026-04-27 to restore required evidence metadata coverage.
- Re-run targeted Slides regression/contract commands from this story when implementation changes are introduced.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
