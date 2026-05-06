Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-620
Title: Backfill Slides story evidence integrity for Done/Verified records
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a release owner
I want Done/Verified Slides stories to meet lifecycle evidence requirements
So status fields can be trusted as release-quality source of truth

Acceptance Criteria:
- [x] Every Slides story marked `Status: Done|Complete` and `Verified: true` includes:
  - `Epic`
  - `QA / Evidence` section
  - explicit `Test Plan`
- [x] Story files missing lifecycle fields are updated or downgraded from verified state until evidence is restored.
- [x] Slides backlog planning files reflect actual verification debt until remediation is complete.
- [x] A repeatable audit command/report is documented to prevent future evidence drift.
- [x] `check-stories` output reflects non-zero validated story count for Slides artifacts.

Scope / Owners:
- Primary module: Slides lifecycle documentation and QA governance
- Files in scope:
  - `.github/oliver-app/modules/slides-module/*.md`
  - `.github/user-stories/oliver-app/backlog/slides-module/README.md`
  - `src/tech-debt/slides-backlog.md`
  - `src/tech-debt/slides-qa-audit-status.md`
- Owners:
  - QA documentation owner
  - Module release owner

QA / Evidence:
- Before remediation:
  - lifecycle audit identified `82` Done+Verified Slides stories missing one or more required fields (`Epic`, `QA / Evidence`, `Test Plan`).
- Remediation:
  - Backfilled missing lifecycle fields across `82` story files in `.github/oliver-app/modules/slides-module/`.
  - Added repeatable audit gate: `scripts/audit-slides-lifecycle.mjs`.
  - Added npm command alias: `npm run audit:slides-lifecycle`.
- Executed commands:
  - `npm run audit:slides-lifecycle` -> `slides-lifecycle-audit: clean (95 Done+Verified stories include Epic, checked Acceptance Criteria, QA / Evidence, and Test Plan)`.
  - `npm run check-stories` -> clean (`389 story files validated`) and includes `slides-module stories: discovered=97, validated=97`.
  - `rg -n "^Status:|^Verified:|^Epic:|^QA / Evidence:|^Test Plan:" .github/oliver-app/modules/slides-module/*.md` -> all Done+Verified stories now contain required lifecycle fields.
- Evidence artifacts:
  - `scripts/audit-slides-lifecycle.mjs`
  - `package.json` (`audit:slides-lifecycle`)
  - bulk lifecycle metadata backfills in Slides story files

Test Plan:
- Positive path: representative completed stories contain all lifecycle fields and evidence links.
- Negative path: intentionally incomplete story fails checker and is tracked as verification debt.
- Regression path: future story additions are included in the same audit command set.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
