Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-440
Title: Template Approval SLA and Escalation Automation
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want SLA-based automation for pending template approvals
So stale requests trigger deterministic escalation and do not remain unresolved indefinitely

Acceptance Criteria:
- [x] Approval records include SLA deadline and escalation state fields.
- [x] Scheduled process flags overdue approvals and writes escalation audit events.
- [x] Escalation routing supports configurable admin targets and notification channels.
- [x] API exposes SLA status fields for queue rendering and requester visibility.
- [x] Escalation processing is idempotent and safe under retries.

QA / Evidence:
- `functions/api/slides.js`:
  - `executeApprovalEscalationSweep` applies overdue threshold (48h), cooldown (24h), updates `payload` with `escalations`, `escalation_count`, and `last_escalated_at`.
- `functions/api/slides.js`:
  - Sweep writes `escalate-approval` audit events, stores heartbeat events for scheduled runs (`readLatestScheduledSweepHeartbeat`) and supports throttling (`sweep_source`, `scheduled`).
- `functions/api/slides.js`:
  - `handleEscalateTemplateApprovalAction` records manual escalation metadata and appends escalation entries.
- `functions/api/slides.js`:
  - `resolveEscalationRoutingConfig` resolves configurable escalation channels (`in-app`, `email`, `slack`) and destination targets from env with owner-policy fallback.
  - Manual and scheduled escalation events persist `routing` metadata (channels, targets, adapters), and related audit details persist `routing_channels` and `routing_targets`.
- `functions/api/slides.js`:
  - `resource=template-approvals` GET path supports status filtering and role-scope protections for requester/admin visibility.
- `src/lib/slides.ts`:
  - Local fallback escalation paths now mirror routing metadata shape so local/e2e behavior remains contract-compatible.
- `tests/contracts/slides-api.contract.test.mjs`:
  - `slides API contract: approval escalation includes configured routing channels and targets`.
- `tests/e2e/slides-regression.spec.ts`:
  - `SLD-FE-440 and SLD-BE-440 show SLA aging and support approval escalation reminders`
  - `SLD-BE-440 admin escalation sweep escalates overdue approvals without manual prompts`
- `tests/e2e/slides-regression.spec.ts`: `SLD-BE-440` assertions confirm escalation count and sweep behavior.
- Verification status:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test:contracts` ✅
  - `npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-BE-440|SLD-FE-440" --workers=1` ✅
  - `npx playwright test tests/e2e/slides-regression.spec.ts tests/e2e/slides-visual.spec.ts --workers=1` ✅ (`50 passed`)

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
