Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-FE-430
Title: Activity Filter Presets and Saved Views
Epic: SLD-STRAT-E5 Save, Recovery, and Governance
Status: Done
Verified: true
Backdated: 2026-04-25
---

As an admin reviewer
I want reusable activity filter presets
So routine compliance reviews do not require rebuilding the same query each session

Acceptance Criteria:
- [x] Activity UI supports save, rename, apply, and delete preset filters.
- [x] Presets include action/outcome/entity/date/search criteria.
- [x] Preset scope supports at least personal and shared-with-admins visibility modes.
- [x] CSV export can run from an applied preset without manual reconfiguration.
- [x] Empty-state guidance includes preset-aware remediation paths.

QA / Evidence:
- `src/app/slides/page.tsx`:
  - `#slides-audit-preset-select`, `#slides-audit-preset-name`, and `#slides-audit-preset-scope` wire into `handleSaveAuditPreset`, `handleApplySelectedAuditPreset`, and `handleDeleteSelectedAuditPreset`.
  - Preset apply resets filter state via `applyAuditPreset` and supports shared preset option for admins.
  - Activity preset workflow includes preset-aware notice and filter hydration and supports export flow in filtered view.
- `functions/api/slides.js`:
  - `handleUpsertAuditPresetAction` implements ownership checks, shared-scope admin gate, dedupe/update-or-create semantics, and scope + criteria persistence.
  - `handleDeleteAuditPresetAction` enforces ownership/admin authorization and archive semantics.
  - `list` path for `audit-presets` enforces personal vs shared visibility for actor role.
- `tests/e2e/slides-regression.spec.ts`:
  - `SLD-FE-430 and SLD-BE-430 save, apply, and delete activity filter presets`
- Verification status:
  - Passed: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WEB_SERVER_PORT=3002 npx playwright test tests/e2e/slides-regression.spec.ts -g "SLD-FE-430 and SLD-BE-430 save, apply, and delete activity filter presets" --workers=1`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
