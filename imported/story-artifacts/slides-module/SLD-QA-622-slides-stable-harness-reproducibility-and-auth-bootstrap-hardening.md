Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-622
Title: Harden Slides stable harness reproducibility and auth bootstrap reliability
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a release owner
I want the Slides stable harness to run reproducibly in clean and local environments
So suite outcomes are actionable and not dominated by harness/env drift

Acceptance Criteria:
- [x] `scripts/run-playwright-slides-stable.sh` documents and enforces required env preconditions (including Supabase-related runtime requirements) with explicit preflight output.
- [x] Harness fails fast with actionable setup diagnostics instead of hanging on server readiness loops.
- [x] Slides e2e suite includes an early auth-shell sanity assertion to detect sign-in fallback immediately.
- [x] Known late-suite auth timeout cascade is either fixed or isolated behind a tracked flaky-test gate with explicit quarantine metadata.
- [x] Stable harness evidence includes two consecutive successful runs (or documented deterministic failure ticket linkage).

Scope / Owners:
- Primary module: Slides QA harness and e2e bootstrap
- Files in scope:
  - `scripts/run-playwright-slides-stable.sh`
  - `docs/modules/slides.md`
  - `tests/e2e/helpers/navigation.ts`
  - `tests/e2e/slides-regression.spec.ts`
  - `tests/e2e/slides-visual.spec.ts`
- Owners:
  - QA automation owner
  - Slides module owner

QA / Evidence:
- Executed commands:
  - `bash scripts/run-playwright-slides-stable.sh --list`
    - prints default suites, required env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and configurable harness vars.
  - `bash scripts/run-playwright-slides-stable.sh tests/e2e/slides-visual.spec.ts` (without Supabase env)
    - fails immediately with actionable preflight diagnostics:
      - `missing required env: NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SLIDES_STABLE_REPEAT_COUNT=2 bash scripts/run-playwright-slides-stable.sh -g "SLD-FE-300 imports class-based CSS layout, colors, and typography from HTML slides"`
    - two consecutive successful runs (`1 passed` each run).
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key bash scripts/run-playwright-slides-stable.sh`
    - passed full stable suite (`68 passed`, `2.0m`) with no late-suite sign-in fallback.
  - `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SLIDES_STABLE_REPEAT_COUNT=2 bash scripts/run-playwright-slides-stable.sh`
    - passed two consecutive full stable runs (`68 passed` per run, `completed 2 run(s) successfully`).
  - `npx playwright test tests/e2e/slides-visual.spec.ts -g "canvas baseline render is stable" --workers=1`
    - passed (`1 passed`) with auth-shell sanity assertion path enabled.
- Code updates:
  - `scripts/run-playwright-slides-stable.sh`
    - added `--list`, preflight dependency/env checks, build-output verification, early server-process death detection, bounded readiness timeout, and explicit run logging.
  - `docs/modules/slides.md`
    - added stable-harness precondition docs and `--list` usage.
  - `tests/e2e/slides-regression.spec.ts`
  - `tests/e2e/slides-visual.spec.ts`
    - added `gotoSlidesWorkspace` helper with early auth-shell sanity assertion (`Parse Pasted HTML` visible; no sign-in heading).
  - `tests/e2e/slides-regression.spec.ts` (`US-SLD-057`)
    - replaced flaky contenteditable fill path with explicit keyboard edit flow, removing deterministic late-suite instability from import-edit-export coverage.
  - `SLD-QA-622` resolution:
    - late-suite auth-timeout cascade no longer reproduces under current stable harness runs; criterion closed via repeated full-suite evidence.

Test Plan:
- Positive path: stable harness executes complete Slides suites in clean setup with explicit required env present.
- Negative path: missing required env fails immediately with setup guidance.
- Regression path: standalone targeted slides e2e tests remain runnable with existing commands.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
