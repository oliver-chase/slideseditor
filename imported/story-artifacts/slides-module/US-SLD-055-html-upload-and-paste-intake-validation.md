Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-055
Title: Validate HTML Upload and Paste Intake With Shared Parser Path
Epic: SLD-STRAT-E1 HTML Intake and Parse Reliability
Status: Done
Verified: true
Backdated: 2026-04-25
---

As a slide editor user
I want reliable upload and paste intake validation before parsing
So invalid inputs fail fast with clear actionable errors

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Upload control accepts `.html` and `.htm` files.
- [x] Empty files are rejected with explicit validation messaging.
- [x] Files above configured size limit are rejected with explicit validation messaging.
- [x] Non-HTML markup payloads are rejected with explicit validation messaging.
- [x] Paste input accepts full HTML documents and partial HTML fragments.
- [x] Empty pasted input is rejected.
- [x] Plain text without markup is rejected.
- [x] Upload and paste both converge to the same parser pipeline after validation.

QA / Evidence:
- `npm run typecheck` passed.
- `node --test tests/contracts/slides-import-validation.contract.test.mjs` passed.
- `npx playwright test tests/e2e/slides-regression.spec.ts -g "US-SLD-055"` passed.
- Verified upload accepts `.html` and `.htm`, rejects empty/plain-text payloads, and paste accepts full documents and fragments before entering the shared parser path.
- Regression hardening on 2026-04-27: uploaded file contents now populate the import textarea immediately before validation completes, so invalid HTML uploads no longer appear inert in the Import workspace; refreshed `US-SLD-055` Playwright coverage passed with upload-state assertions.

Progress Notes (2026-04-27):
- Added shared HTML intake validation for file uploads and paste preflight.
- Upload validation now rejects empty and non-HTML payloads before parsing, with explicit messages.
- Added contract and Playwright regression coverage for acceptance and guardrail cases.

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
