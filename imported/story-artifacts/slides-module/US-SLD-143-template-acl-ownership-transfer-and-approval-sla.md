Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-143
Title: Template ACL, Ownership Transfer, and Approval SLA
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slide Editor user

I want template acl, ownership transfer, and approval sla
So Slide Editor reliably supports this workflow end-to-end

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Private/shared and collaborator roles enforced by API and UI.
- [x] Ownership transfer follows approval flow with status and escalation.
- [x] All governance actions are auditable/exportable.

Required Tests:
- [x] E2E: collaborator visibility and delegated private-template workflow.
- [x] E2E: approval SLA escalation sweep behavior and audit surfacing.
- [x] Contract: approval escalation routing + template governance API envelopes.

Implementation Notes:
- Canonical source: `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Story file created during strategy/story normalization to ensure one-file-per-canonical-story coverage.

QA / Evidence:
- `npx playwright test tests/e2e/slides-regression.spec.ts --grep "SLD-BE-440 admin escalation sweep escalates overdue approvals without manual prompts|SLD-FE-410 collaborator visibility allows members to use private delegated templates"` -> pass (`2/2`).
- `node --test tests/contracts/slides-api.contract.test.mjs` -> pass (`13/13`), including approval escalation routing + governance envelopes.
- `npm run -s qa:hygiene` -> pass (workflow/story governance, blocked/in-progress contracts, cloudflare build contract, and story validation all clean).

Test Plan:
- [x] Positive-path coverage mapped to acceptance criteria.
- [x] Negative or guardrail path coverage mapped to at least one critical failure mode.
- [x] Regression coverage mapped for adjacent shared behavior impacted by this story.
