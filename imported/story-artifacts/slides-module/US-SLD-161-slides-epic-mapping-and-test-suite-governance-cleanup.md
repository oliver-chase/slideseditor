Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-161
Title: Slides Epic Mapping and Test Suite Governance Cleanup
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
Backdated: 2026-05-01
---

As a Slides module maintainer
I want stories, tests, and commits consistently grouped by epic with explicit AC/evidence
So that updates are faster to implement, easier to find, and safer to validate

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Slides backlog root includes a current epic map and explicitly flags `epic-unassigned` debt.
- [x] Slides backlog root defines required story metadata and test evidence expectations for all new/updated stories.
- [x] Slides backlog root documents test suite lanes (contracts, regression, visual) so contributors know where to add/maintain coverage.
- [x] Slides backlog root provides quick commands to locate stories, epics, and unassigned entries.
- [x] Legacy `epic-unassigned` Slides stories are reassigned into explicit epics in prioritized slices without breaking story IDs.

Implementation Notes:
- Backlog governance updates live in `/.github/user-stories/oliver-app/backlog/slides-module/README.md`.
- This story intentionally separates process/governance from feature implementation.

QA / Evidence:
- Manual doc review confirms epic map, test-governance rules, and find/update commands are present in backlog root.
- `rg -n '^Epic: epic-unassigned$' .github/oliver-app/modules/slides-module/US-SLD-*.md` returns no remaining unassigned Slides stories.
- `npm run -s check-stories` passes with `slides-module stories: discovered=118, validated=118`.
- `npm run -s audit:slides-lifecycle` passes with `97 Done+Verified` stories meeting lifecycle requirements.

Test Plan:
- Positive path: maintainer can locate epic ownership and required test expectations from one file.
- Negative path: if a story lacks AC/evidence/test plan, it is blocked from verified closure by documented rules.
- Regression path: epic map and quick commands remain updated when new Slides stories are added.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after command-level QA evidence and governance checks were revalidated.
