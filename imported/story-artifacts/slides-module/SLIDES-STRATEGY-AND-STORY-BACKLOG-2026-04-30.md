# Slide Editor Product Strategy and Execution Backlog (2026-04-30)

## 1) Product Definition

### Vision
Slide Editor converts arbitrary HTML (paste or file upload) into a visual, editable slide workspace where users can restructure content, resize/crop responsively, and export high-fidelity presentation artifacts (especially PPTX) that remain usable in downstream presentation workflows.

### Primary User Outcomes
1. Import any realistic marketing/sales/design HTML and see it rendered immediately.
2. Edit everything important on-canvas without coding.
3. Resize or crop output to target aspect/slide sizes while preserving usable layout.
4. Export to PPTX (and HTML/PDF/reveal.js) with predictable fidelity and transparent warnings.
5. Save/reuse/share templates and activity history safely in team workflows.

### Non-Negotiable Product Principles
1. No dead-end states.
2. No hidden destructive behavior.
3. Every warning must be actionable.
4. Editing must be WYSIWYG enough for non-technical users.
5. Reliability and trust beat feature count.

## 2) Target User Segments and Jobs-to-be-Done

1. Sales/Founders: convert landing-page snippets and artifacts into investor/client decks quickly.
2. Marketing/Ops: reuse branded templates, swap content, export predictable PPTX for distribution.
3. Design/Enablement: ingest web artifacts, tune layout in a controlled canvas, publish reusable internal templates.

## 3) End-to-End Journey (Canonical)

1. Entry: open `/slides` and choose `Paste HTML` or `Upload HTML`.
2. Intake validation: verify type/size/markup and surface preflight warnings.
3. Parse + render: normalize HTML/CSS, build editable component graph, render scaled canvas.
4. Edit pass: select/move/resize/style/align/group; lock where needed.
5. Responsive pass: choose target canvas/aspect; apply intelligent repositioning and resolve warnings.
6. Save + govern: save draft/slide, publish template, share/collaborate where permitted.
7. Export: choose format and scope (current or selected slides), generate artifact, download.
8. Audit + recover: view activity, restore from draft/revision if needed.

## 4) Data and System Contracts (Product-Critical)

1. Canonical model: SlideDocument is the source of truth for all edit/export paths.
2. Import contract: HTML/CSS ingestion must emit structured warnings and deterministic coordinates.
3. Export contract: every export path reads from canonical SlideDocument; no divergent hidden models.
4. Persistence contract: save/autosave/recovery/revision semantics are consistent across tabs and sessions.
5. Governance contract: template ACL/approvals/audits are role-gated and traceable.

## 4.1) Frontend Interaction Coverage Contract (Buttons, Clicks, Inputs)

Every user-triggerable control in Slides must have:
1. A deterministic UI state transition.
2. A mapped frontend handler.
3. A mapped backend contract (if data mutates or is fetched).
4. At least one positive-path and one negative-path test.

Canonical interaction families:
1. Import actions:
1. `Upload HTML` button, file picker, drag/drop zone, `Parse` submit, `Cancel import`.
2. Editor actions:
1. layer select, multi-select, drag, resize, align, distribute, group/ungroup, lock/unlock, text edit, undo/redo.
3. Canvas actions:
1. aspect preset buttons, custom size submit, crop apply, crop reset.
4. Persistence/governance actions:
1. save draft, autosave replay, publish template, transfer ownership, approve/reject escalation.
5. Export actions:
1. export current slide, export selected slides, export warning report download, format switching.
6. Navigation/actions around module shell:
1. tab switches (Import/My Slides/Template Library/Activity), cross-module transitions, chatbot command actions.

Required coverage rules:
1. No new control ships without being added to interaction inventory and click-path tests.
2. Disabled states and permission-denied states are required test cases for all destructive or privileged actions.
3. Keyboard accessibility paths (`Enter`/`Space`/arrow/tab flows) are required for primary controls.

## 4.2) Visual Design Quality Contract (Expert-Level UI Standard)

Slides UI quality bar:
1. Information hierarchy is explicit at first glance (primary task, secondary actions, status).
2. Spacing, alignment, and typography are token-driven and visually consistent across states.
3. Action affordances are unambiguous (clear primary/secondary/destructive differentiation).
4. Empty/loading/error/degraded states are designed, not placeholder-only.
5. Desktop and mobile layouts preserve control discoverability with no overlap/hidden-critical actions.

Design enforcement:
1. Design-system components/tokens are mandatory for new UI.
2. Visual regression snapshots must include: import empty, parse error, canvas edit, export warning, activity empty/error.
3. Any visual deviation from shared module standards requires explicit documented rationale.

## 5) Prioritized Execution Epics

## EPIC SLD-STRAT-E1: HTML Intake and Parse Reliability (P0)
Goal: users can import realistic HTML and get an editable result reliably.

### US-SLD-101 Robust HTML Input Intake
- As a user, I can paste or upload HTML and always get clear validation feedback.
- Acceptance Criteria:
1. `.html` and `.htm` accepted by upload.
2. Invalid type/empty markup blocked with explicit error copy.
3. Large files show deterministic size error before parse.
4. File content always appears in textarea before parse result.
- Required Tests:
1. E2E: upload valid/invalid/empty/oversized cases.
2. Contract: validation function unit + edge matrix.

### US-SLD-102 Multi-Root and Fragment Normalization
- As a user, malformed but recoverable HTML is normalized into the first valid document root.
- Acceptance Criteria:
1. Multiple `<html>` roots normalize to one import target.
2. Document fragments parse without requiring full `<html><body>` scaffolding.
3. Warning explains normalization behavior.
- Required Tests:
1. E2E: multi-root fixture with warning assertion.
2. Unit: root normalization helper cases.

### US-SLD-103 CSS Cascade and External Styles Resolution
- As a user, class-based styles render in expected order.
- Acceptance Criteria:
1. Inline + linked + nested `@import` order preserved.
2. Missing external stylesheets generate non-blocking warning.
3. Class-based coordinates/typography retain expected values.
- Required Tests:
1. E2E: class CSS parity fixture (position/font/line-height/color).
2. Contract: style source ordering assertions.

### US-SLD-104 Fallback Safety for Unsupported Nodes
- As a user, unsupported nodes are still represented so output is never blank.
- Acceptance Criteria:
1. Unsupported sections import as locked fallback layers.
2. Warning taxonomy groups unsupported reasons.
3. Parse never returns empty canvas for non-empty valid HTML without explicit reason.
- Required Tests:
1. E2E: unsupported structures produce locked fallback + warnings.
2. Unit: warning group classification.

## EPIC SLD-STRAT-E2: Visual Editing and Canvas UX (P0)
Goal: imported content is truly editable and controllable.

### US-SLD-111 Editable Layer Reconstruction
- Acceptance Criteria:
1. Parsed components auto-select first editable layer.
2. Layer inspector controls activate immediately.
3. Layer list hierarchy mirrors visible structure.
- Required Tests: E2E selection/editability + inspector enablement.

### US-SLD-112 Precision Manipulation (Move/Resize/Align/Distribute)
- Acceptance Criteria:
1. Drag + keyboard nudge with bounds safety.
2. Resize handles with min/max constraints.
3. Align/distribute works for multi-select.
- Required Tests: E2E interaction coverage + regression snapshots.

### US-SLD-113 Inline Text and Style Editing
- Acceptance Criteria:
1. Inline edit round-trips to canonical JSON.
2. Style controls update render and persisted model.
3. Locked layers prevent mutation.
- Required Tests: E2E text/style/lock matrix.

### US-SLD-114 Layer Grouping, Z-Order, and Lock Semantics
- Acceptance Criteria:
1. Group/ungroup preserves positional integrity.
2. Bring-forward/send-back updates z-order deterministically.
3. Locked groups enforce non-editability.
- Required Tests: E2E grouping + ordering + lock semantics.

## EPIC SLD-STRAT-E3: Responsive Resize, Crop, and Aspect Intelligence (P0)
Goal: users can transform imported layouts to target presentation sizes safely.

### US-SLD-121 Canvas Target Presets + Custom Sizes
- Acceptance Criteria:
1. Presets include 16:9, 4:3, 1:1 and custom dimensions.
2. Size switch updates canvas without data loss.
3. Resize action is undoable.
- Required Tests: E2E size-switch + undo/redo.

### US-SLD-122 Intelligent Reflow/Reposition Rules
- Acceptance Criteria:
1. Constrained elements (stack/grid/pinned) adapt predictably across aspect changes.
2. Unconstrained elements preserve relative location where possible.
3. Reflow warnings appear when manual intervention is required.
- Required Tests: E2E responsive scenarios + fixture parity assertions.

### US-SLD-123 Crop Workflow and Safe Bounds
- Acceptance Criteria:
1. Users can crop visible canvas area without corrupting source components.
2. Out-of-bounds items are surfaced in warnings/navigation aids.
3. Crop is reversible.
- Required Tests: E2E crop/apply/revert flow.

## EPIC SLD-STRAT-E4: Export Fidelity and Artifact Trust (P0)
Goal: exported files are usable and predictable for real presentations.

### US-SLD-131 PPTX Native Object Priority
- Acceptance Criteria:
1. Text/shape/image components map to editable PPTX-native objects where supported.
2. Unsupported constructs are explicitly listed in warning report.
3. Artifact metadata includes generation profile and fidelity notes.
- Required Tests: contract + e2e export warning assertions.

### US-SLD-132 Multi-Slide Export Orchestration
- Acceptance Criteria:
1. Single and selected multi-slide export supported.
2. Async job lifecycle status is queryable and resilient.
3. Download endpoints enforce ownership/permissions.
- Required Tests: API contract + E2E export job journey.

### US-SLD-133 Format Parity: HTML/PDF/reveal.js
- Acceptance Criteria:
1. HTML export round-trips into parser with bounded drift.
2. PDF/reveal.js exports represent active slide order and dimensions.
3. Failure states include retry guidance.
- Required Tests: E2E and contract tests by format.

## EPIC SLD-STRAT-E5: Save, Recovery, and Governance (P1)
Goal: no work loss and controlled team reuse.

### US-SLD-141 Autosave + Retry Budget + Degraded Mode
- Acceptance Criteria:
1. Autosave retries with bounded backoff.
2. Critical mutation failures trigger degraded mode with clear status.
3. Non-critical read failures do not trigger full degraded mode.
- Required Tests: contract + e2e degraded-mode scenarios.

### US-SLD-142 Revision Conflict Resolution
- Acceptance Criteria:
1. Conflicts detect stale revisions.
2. User can reload/merge/save safely.
3. Audit logs include conflict lifecycle.
- Required Tests: E2E conflict workflows.

### US-SLD-143 Template ACL, Ownership Transfer, and Approval SLA
- Acceptance Criteria:
1. Private/shared and collaborator roles enforced by API and UI.
2. Ownership transfer follows approval flow with status and escalation.
3. All governance actions are auditable/exportable.
- Required Tests: API contract + E2E governance queue.

## EPIC SLD-STRAT-E6: Quality Platform and Operability (P1)
Goal: reliable releases and maintainable architecture.

### US-SLD-151 FE Orchestrator Decomposition Completion
- Acceptance Criteria:
1. `src/app/slides/page.tsx` contains composition/render only, not heavy orchestration.
2. Import/editor/export/governance concerns are isolated in hooks/modules.
3. Behavior parity is contract-tested.
- Required Tests: decomposition contract + regression suite.

### US-SLD-152 BE Router Decomposition Completion
- Acceptance Criteria:
1. `functions/api/slides.js` route/action monolith split by concern.
2. Existing envelopes/status semantics remain backward-compatible.
3. Failure-class logging boundaries preserved.
- Required Tests: route-family contract tests + integration checks.

### US-SLD-153 Stable Harness and Release Gates
- Acceptance Criteria:
1. Stable harness reproducibly passes on repeated runs.
2. Required suite matrix is codified for PR/merge gates.
3. Lifecycle evidence must map each completed story to proof.
- Required Tests: harness script checks + policy contract tests.
- Execution-linked stories:
1. `SLD-QA-622` stable harness reproducibility and auth bootstrap hardening.
2. `SLD-QA-623` navigation retry hardening for transient webserver dropouts.
3. `US-SLD-154` import-ingestion warning type contract deploy blocker fix.
4. `US-SLD-155` PPTX export dependency declaration contract for production build stability.
5. `US-SLD-156` full frontend interaction inventory and click-path enforcement.
6. `US-SLD-157` expert-level visual design quality gate and parity checks.

### US-SLD-156 Frontend Interaction Inventory and Click-Path Enforcement
- Acceptance Criteria:
1. A canonical interaction inventory exists for all Slides controls (buttons/clicks/keyboard paths) mapped to FE handlers and BE contracts.
2. Every critical interaction family includes at least one happy path + one denied/failure path e2e test.
3. Inventory updates are required in same PR when adding/removing user-triggerable controls.
- Required Tests:
1. E2E click-path suites for Import, Editor, Canvas, Save/Governance, Export, Shell navigation.
2. Contract test asserting inventory coverage references active test IDs.

### US-SLD-157 Expert-Level Visual Design Gate
- Acceptance Criteria:
1. Slides states conform to visual hierarchy and token-usage rules with no raw off-system styling.
2. Critical UI states pass desktop and mobile visual parity checks.
3. Primary action discoverability and disabled/error states are explicitly verified in regression coverage.
- Required Tests:
1. Visual regression for core states (import, edit, export warning, activity/degraded).
2. Mobile click/overflow assertions for control visibility and non-overlap.

## 6) Global Acceptance and Test Policy (Applies to Every Story)

1. No story is `Done` without AC, implementation evidence, and test evidence.
2. Every story requires:
1. At least one automated behavior test.
2. At least one negative-path assertion.
3. Traceability to journey stage and risk class.
3. Every feature touching import/export must include drift/fidelity assertions.
4. Every permission-sensitive feature must include role-based contract coverage.

## 7) Release Sequencing

1. Wave A (P0 import/edit/responsive/export): US-SLD-101..104, 111..114, 121..123, 131..133.
2. Wave B (P1 reliability/governance): US-SLD-141..143.
3. Wave C (P1 architecture/quality): US-SLD-151..153.

## 8) Explicit Scope Cuts (Remove or Defer)

1. Any duplicate/backfilled story whose behavior is already enforced by newer canonical stories should be archived to historical docs.
2. Any pseudo-done story lacking behavior tests must be reopened under this backlog.
3. No new feature work starts until Wave A regressions are consistently green.

## 9) Immediate Execution Queue

1. US-SLD-101 Robust HTML Input Intake
2. US-SLD-103 CSS Cascade and External Styles Resolution
3. US-SLD-121 Canvas Target Presets + Custom Sizes
4. US-SLD-131 PPTX Native Object Priority
5. US-SLD-151 FE Orchestrator Decomposition Completion
6. US-SLD-152 BE Router Decomposition Completion
7. US-SLD-156 Frontend Interaction Inventory and Click-Path Enforcement
8. US-SLD-157 Expert-Level Visual Design Gate

## 10) Success Metrics

1. Import success rate (valid HTML) >= 99%.
2. User-visible parse failure rate (non-validation) <= 1%.
3. Export success rate >= 99% with warning transparency.
4. Draft-loss incidents trend to 0.
5. Median time from import to first successful export reduced release-over-release.
