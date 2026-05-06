Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-BE-150
Title: Unsaved-Change Telemetry Ingestion and Metrics Contract
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a platform maintainer
I want backend ingestion and query support for unsaved-change telemetry
So discard-risk trends and reliability KPIs are measurable and auditable

Acceptance Criteria:
- [x] Backend endpoint or pipeline accepts structured unsaved-change telemetry events with schema validation.
- [x] Storage model supports time-series aggregation by module, actor role, and event type.
- [x] Query contract exposes discard rate, retry rate, and prompt-cancel rate over selectable date windows.
- [x] Retention and privacy controls are documented for telemetry payload fields.
- [x] Operational alert thresholds can be configured for elevated discard-risk trends.

Execution Evidence (2026-04-26):
- Added `/api/slides` telemetry contract in `functions/api/slides.js`:
  - `POST action=record-telemetry`
  - `GET resource=telemetry-summary`
  - schema validation for event type/workspace/save status/trigger source
  - bounded retention with summary aggregation for discard/retry/prompt-cancel rates
  - configurable alert thresholds via `SLIDES_DISCARD_RATE_ALERT_THRESHOLD` and `SLIDES_RETRY_RATE_ALERT_THRESHOLD`
- Added shared client wrappers in `src/lib/slides.ts`:
  - `recordUnsavedTelemetryEvent(...)`
  - `getUnsavedTelemetrySummary(...)`
- Documented retention/privacy/event matrix:
  - `/.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`
- Contract coverage:
  - `tests/contracts/slides-api.contract.test.mjs`
    - `slides API contract: unsaved telemetry events validate schema and echo normalized payload`
    - `slides API contract: telemetry summary exposes discard and retry rates by window`

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
