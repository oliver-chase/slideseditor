Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-440
Title: Approval Aging SLA Signal and Escalation UI
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As an admin reviewer
I want pending approvals ranked by age with clear SLA state
So governance requests do not stall unnoticed and user journeys do not dead-end

Acceptance Criteria:
- [x] Approval queue surfaces submitted-at age and SLA status badges (on-time, due-soon, overdue).
- [x] Queue supports sorting/filtering by age, type, and requester.
- [x] Overdue approvals show escalation action affordance and reason capture.
- [x] Requesters can see non-admin status progression without admin-only controls.
- [x] UI copy and notifications avoid dead-end messaging when approvals are delayed.

QA / Evidence:
- `src/app/slides/page.tsx`:
  - `getApprovalSlaState` computes SLA labels (`SLA Healthy`, `SLA At Risk (24h+)`, `SLA Overdue (48h+)`) and age labels.
  - Template approval cards render SLA state, age, escalation counts, and last escalation metadata.
  - Admin view includes escalation sweep action (`Run SLA Escalation Sweep`) and overdue count.
  - Non-admin view uses requester-only queue copy (`My Pending Approval Requests`) and shows pending items without admin controls.
- `src/app/slides/page.tsx`:
  - Manual escalation action is available for overdue/scope-eligible approvals and supports reason capture through the escalation prompt path.
- `tests/e2e/slides-regression.spec.ts`:
  - `SLD-FE-440 and SLD-BE-440 show SLA aging and support approval escalation reminders`
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-440 and SLD-BE-440 show SLA aging and support approval escalation reminders" --workers=1`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
