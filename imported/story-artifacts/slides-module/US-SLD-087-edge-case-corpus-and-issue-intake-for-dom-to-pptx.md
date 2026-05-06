Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-087
Title: Edge-Case Corpus and Issue Intake for DOM→PPTX
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a platform maintainer
I want reproducible HTML/CSS edge-case intake tied to regression fixtures
So real-world export failures become trackable, testable, and non-regressing fixes

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Issue intake template requires minimal repro HTML/CSS snippet and expected vs actual PPTX behavior.
- [x] Submitted edge cases can be converted into fixture assets used by contract/e2e export tests.
- [x] Corpus tags include at minimum: deep flex, unusual gradients, nested transforms, font embedding, and dashboard canvas.
- [x] New edge-case fixture failures block release until mapped stories are resolved or explicitly waived.
- [x] Module docs include triage guidance for fidelity mismatch reporting.

Implementation Evidence:
- `.github/oliver-app/modules/slides-module/DOM-TO-PPTX-ISSUE-INTAKE-TEMPLATE.md`
  - added required minimal repro intake format plus triage/waiver rules for DOM→PPTX fidelity reports.
- `.github/oliver-app/modules/slides-module/DOM-TO-PPTX-EDGE-CASE-CORPUS.json`
  - added canonical corpus manifest tying required tags to fixture paths, mapped stories, regression targets, and waiver state.
- `tests/fixtures/slides/pptx-edge-*.html`
  - added baseline fixture assets for deep flex, gradients, nested transforms, font embedding, and dashboard canvas coverage.
- `tests/contracts/slides-pptx-edge-case-corpus.contract.test.mjs`
  - added release-blocking corpus validation so missing tags, fixture assets, mapped stories, or malformed waivers fail the contract gate.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-edge-case-corpus.contract.test.mjs tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`
- Passed: `npm run check-stories`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
