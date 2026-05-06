Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-210
Title: Template Library Thumbnail and Preview Picker
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide creator
I want visual thumbnails and quick preview in template selection
So I can choose the right template without dead-end trial-and-error duplication

Acceptance Criteria:
- [x] Template cards display thumbnail preview with accessible fallback when image is missing.
- [x] Template list supports consistent skeleton/loading state while previews hydrate.
- [x] Users can open a quick preview modal/panel with larger render before duplication.
- [x] Cards indicate stale/missing preview status and offer refresh action for owners/admins.
- [x] Search and filter behavior remains consistent with thumbnails enabled.

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
