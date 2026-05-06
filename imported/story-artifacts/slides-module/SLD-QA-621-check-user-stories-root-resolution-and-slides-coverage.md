Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-621
Title: Repair check-stories root resolution to validate Slides story artifacts
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a QA platform owner
I want `check-user-stories` to validate real Slides story files
So lifecycle/documentation gate failures are detected before merge

Acceptance Criteria:
- [x] `scripts/check-user-stories.mjs` resolves and validates story files under both:
  - `.github/user-stories/oliver-app`
  - `.github/oliver-app/modules`
  without silently skipping module stories.
- [x] Gate fails when expected story files exist but validated count is zero.
- [x] Slides story validation count is non-zero on current `main`.
- [x] Script output clearly reports scanned roots and validated story count by root.
- [x] Existing structure checks continue to run and pass/fail deterministically.

Scope / Owners:
- Primary module: QA gate scripts
- Files in scope:
  - `scripts/check-user-stories.mjs`
  - `package.json` (only if script invocation needs adjustment)
  - optional test/fixture for checker behavior
- Owners:
  - QA platform/script owner

QA / Evidence:
- Implementation summary:
  - Story root selection now scans both configured roots instead of selecting a single preferred root.
  - Story discovery includes `US-*`, `SLD-(FE|BE|QA|TECH)-*`, and `SMK-*` ticket files.
  - Script now reports discovered/validated counts by scanned root plus Slides module-specific counts.
  - Guardrails now fail explicitly when discovery returns zero files or when discovered files validate to zero.
- Executed commands:
  - `npm run check-stories`
    - clean output:
      - roots scanned:
        - `.github/user-stories/oliver-app (discovered=0, validated=0)`
        - `.github/oliver-app/modules (discovered=365, validated=365)`
      - `slides-module stories: discovered=89, validated=89`
  - `CHECK_STORIES_INCLUDE_DEFAULT_ROOTS=0 CHECK_STORIES_ROOTS=.github/user-stories/oliver-app/backlog node scripts/check-user-stories.mjs`
    - Expected zero-discovery guard failure:
      - `.github/user-stories/oliver-app/backlog (discovered=0, validated=0)`
      - `story-discovery: no story files discovered under configured roots`.
- Evidence artifacts:
  - Updated script: `scripts/check-user-stories.mjs`
  - Captured output above demonstrates non-zero Slides validation and explicit zero-discovery failure behavior.

Test Plan:
- Positive path: Slides stories are discovered and validated from module path.
- Negative path: synthetic zero-story scenario triggers explicit failure.
- Regression path: campaigns/reviews story checks remain unaffected.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
