Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-410
Title: Template Ownership + Collaborator Governance Contract
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want backend ownership and collaborator governance actions with strict authorization checks
So template delegation workflows remain enforceable and auditable when governance changes

Acceptance Criteria:
- [x] `POST /api/slides` supports `transfer-template-owner` with template id plus target user id/email.
- [x] API enforces owner/admin transfer rights before updating `owner_user_id`.
- [x] Destination account must exist and have slides access before transfer succeeds.
- [x] Transfer events are written to `slide_audit_events` with previous/next ownership details.
- [x] API supports collaborator upsert/remove actions with owner/admin authorization and target-user slides-access checks.
- [x] Non-admin template visibility includes delegated collaborator access for private templates.
- [x] Approval workflow persists pending governance actions and supports admin approve/reject resolution with audit events.

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
