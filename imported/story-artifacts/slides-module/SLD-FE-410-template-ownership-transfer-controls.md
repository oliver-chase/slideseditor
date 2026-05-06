Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-410
Title: Template Ownership + Collaborator Controls
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide template owner or admin
I want to transfer template ownership and manage collaborator roles from the template library
So governance workflows do not require backend intervention and avoid dead-end delegation paths

Acceptance Criteria:
- [x] Template cards surface current owner context.
- [x] Owner/admin users can open transfer controls and submit a destination email or user id.
- [x] Successful transfer refreshes template library state and records an activity event.
- [x] Owner/admin users can assign and remove collaborator roles (editor/reviewer/viewer) from template cards.
- [x] Collaborator members can see delegated private templates and duplicate them to My Slides.
- [x] Regression coverage validates transfer flow and activity filtering for transfer events.
- [x] Approval UX supports owner-submitted governance requests and admin approve/reject resolution from Template Library.

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
