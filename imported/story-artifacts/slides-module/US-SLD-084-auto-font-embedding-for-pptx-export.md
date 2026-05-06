Owner: Unassigned
Last updated: 2026-05-04

---
ID: US-SLD-084
Title: Auto-Font Embedding for PPTX Export
Epic: SLD-STRAT-E4 Export Fidelity and Artifact Trust
Status: Done
Verified: true
Backdated: 2026-04-26
---

As a presentation author
I want export to embed actual CSS font assets
So slides do not fall back to default fonts in PowerPoint

Current state: Done and verified. This story documents completed Slides module behavior and preserves implementation scope, acceptance criteria, QA evidence, and regression coverage for future consolidation and maintenance.

Acceptance Criteria:
- [x] Export scans computed CSS/font-face declarations and resolves font file URLs used by slide content.
- [x] PPTX package embeds resolved font files when licensing/availability allow.
- [x] Font mapping preserves family/weight/style intent for heading/body text layers.
- [x] Missing or blocked fonts degrade with deterministic fallback and explicit warnings.
- [x] Regression fixtures verify no silent Arial/default fallback when embeddable font assets are available.

Implementation Evidence:
- `functions/api/slides.js`
  - added request/slide font-face sanitization and a PPTX `font_manifest` that records used fonts plus embeddable resolved assets.
  - added deterministic `font_embed_unavailable` warnings scoped to slide/component ids when a used font lacks an embeddable allowed asset.
- `tests/contracts/slides-pptx-export.contract.test.mjs`
  - verifies embeddable declared fonts are retained in the manifest, blocked fonts warn on the correct component, and used family/weight intent remains preserved in native text output.

QA / Evidence:
- Passed: `node --test tests/contracts/slides-pptx-export.contract.test.mjs`
- Passed: `npm run typecheck`
- Passed: `npm run check-stories`

Test Plan:
- Positive path: acceptance criteria in this story continue to hold on current `main` behavior.
- Negative path: intentionally break a core behavior in this story scope and confirm linked regression coverage fails.
- Regression path: run `npm run check-stories` plus scoped Slides contract/e2e coverage before marking future edits verified.

Lifecycle Remediation Notes (2026-05-01):
- Story restored to `Done` + `Verified` after AC and command-level QA evidence were revalidated.
