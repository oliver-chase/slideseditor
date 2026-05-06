# slides-module Current Module Truth

## Module purpose

The Slides module is the slide import, editing, deck management, export, and diagnostics workspace inside Oliver App. Its purpose is to let users import or create slide content, render it on an editable canvas, manage slide/deck structure, inspect and edit layers, save or sync work safely, and export usable slide artifacts without relying on old activity-page patterns.

## Current intended state

The module should operate as a focused Slides Workspace, not a scattered set of vertical panels or an Activity-centered experience. The current direction is to preserve import, editable canvas, slide/deck setup, layer inspection, save/sync behavior, diagnostics, and export functionality while removing unnecessary visual clutter and avoiding reintroduction of the Activity subpage.

## Active routes / pages / workspaces

### Keep

- /api/slides
- /slides

### Rename

TBD.

### Remove

- Activity workspace/subpage in normal Slides navigation.

### Merge

TBD.

## Current functionality that must remain

- Import or paste HTML into the Slides workspace.
- Render imported slide content on an editable canvas.
- Preserve editable layer reconstruction, selection, positioning, resizing, z-order, locking, grouping, and inline text/style editing where currently supported.
- Preserve slide/deck data model, multi-slide deck behavior, save/autosave, retry/degraded mode, conflict handling, diagnostics, and export paths.
- Preserve HTML/PDF/PPTX/Reveal-style export capabilities where currently implemented and verified.
- Preserve action-to-table/RLS expectations from the Slides matrix.

## Current functionality that must change

- Reduce visual clutter in the Slides editor/workspace.
- Remove or keep archived the Activity workspace from normal Slides navigation.
- Make the canvas/editor the dominant workspace area.
- Clarify import, slide setup, deck slides, canvas settings, inspector, layers, export, diagnostics, and keyboard shortcuts without stacking everything vertically.
- Verify the two active repair candidates before treating them as implementation work.

## Explicitly deprecated or removed

- Do not reintroduce the Slides Activity subpage/workspace into normal left navigation.
- Do not rebuild the old vertical everything-stacked editor layout.
- Do not treat completed Done/Verified implementation stories as open work.
- Do not remove current import, canvas, inspector, save/sync, diagnostics, or export functionality while redesigning the interface.

## Source-of-truth documents to read first

- Slides Gap Register — `.github/oliver-app/modules/slides-module/GAP-REGISTER.md`
- Slides Module — `.github/oliver-app/modules/slides-module/README.md`
- Slides Action-To-Table And RLS Matrix — `.github/oliver-app/modules/slides-module/SLIDES-ACTION-TABLE-RLS-MATRIX.md`
- Slides Active Context — `.github/oliver-app/modules/slides-module/SLIDES-ACTIVE-CONTEXT.md`
- Slide Editor Product Strategy and Execution Backlog (2026-04-30) — `.github/oliver-app/modules/slides-module/SLIDES-STRATEGY-AND-STORY-BACKLOG-2026-04-30.md`

## Completed current capability stories

These stories appear Done and Verified. They may describe current capability, but they should not be treated as open implementation work unless current code contradicts them.

- SLD-QA-614-slides-full-journey-click-data-visual-certification — `.github/oliver-app/modules/slides-module/SLD-QA-614-slides-full-journey-click-data-visual-certification.md`
- SLD-QA-620-slides-story-lifecycle-evidence-backfill-and-verification-integrity — `.github/oliver-app/modules/slides-module/SLD-QA-620-slides-story-lifecycle-evidence-backfill-and-verification-integrity.md`
- SLD-QA-624-slides-functional-audit-ledger-and-runtime-hardening-closeout — `.github/oliver-app/modules/slides-module/SLD-QA-624-slides-functional-audit-ledger-and-runtime-hardening-closeout.md`
- SLD-QA-627-slides-action-to-table-rls-contract-matrix — `.github/oliver-app/modules/slides-module/SLD-QA-627-slides-action-to-table-rls-contract-matrix.md`
- US-SLD-003-promote-slide-parser-security-and-normalization-stories — `.github/oliver-app/modules/slides-module/US-SLD-003-promote-slide-parser-security-and-normalization-stories.md`
- US-SLD-004-align-slide-module-copy-with-current-capabilities — `.github/oliver-app/modules/slides-module/US-SLD-004-align-slide-module-copy-with-current-capabilities.md`
- US-SLD-013-import-export-roundtrip-fixture-reliability — `.github/oliver-app/modules/slides-module/US-SLD-013-import-export-roundtrip-fixture-reliability.md`
- US-SLD-020-render-editable-slide-canvas-from-component-json — `.github/oliver-app/modules/slides-module/US-SLD-020-render-editable-slide-canvas-from-component-json.md`
- US-SLD-030-slide-and-template-data-model-with-rls — `.github/oliver-app/modules/slides-module/US-SLD-030-slide-and-template-data-model-with-rls.md`
- US-SLD-033-html-and-pdf-export-service-contract — `.github/oliver-app/modules/slides-module/US-SLD-033-html-and-pdf-export-service-contract.md`
- US-SLD-050-import-render-fidelity-from-html — `.github/oliver-app/modules/slides-module/US-SLD-050-import-render-fidelity-from-html.md`
- US-SLD-051-enforce-canonical-slide-document-json — `.github/oliver-app/modules/slides-module/US-SLD-051-enforce-canonical-slide-document-json.md`
- US-SLD-052-complete-export-system-html-pdf-pptx — `.github/oliver-app/modules/slides-module/US-SLD-052-complete-export-system-html-pdf-pptx.md`
- US-SLD-053-support-multi-slide-decks — `.github/oliver-app/modules/slides-module/US-SLD-053-support-multi-slide-decks.md`
- US-SLD-054-proportional-canvas-resize-without-reflow — `.github/oliver-app/modules/slides-module/US-SLD-054-proportional-canvas-resize-without-reflow.md`
- US-SLD-057-edit-imported-layers-and-canvas-normalization-contract — `.github/oliver-app/modules/slides-module/US-SLD-057-edit-imported-layers-and-canvas-normalization-contract.md`
- US-SLD-058-sample-artifacts-slide-parity-gate — `.github/oliver-app/modules/slides-module/US-SLD-058-sample-artifacts-slide-parity-gate.md`
- US-SLD-063-revealjs-deck-export — `.github/oliver-app/modules/slides-module/US-SLD-063-revealjs-deck-export.md`
- US-SLD-065-editor-ux-layer-grouping-and-zindex-controls — `.github/oliver-app/modules/slides-module/US-SLD-065-editor-ux-layer-grouping-and-zindex-controls.md`
- US-SLD-070-v3-responsive-layout-and-aspect-ratio-intelligence — `.github/oliver-app/modules/slides-module/US-SLD-070-v3-responsive-layout-and-aspect-ratio-intelligence.md`
- US-SLD-087-edge-case-corpus-and-issue-intake-for-dom-to-pptx — `.github/oliver-app/modules/slides-module/US-SLD-087-edge-case-corpus-and-issue-intake-for-dom-to-pptx.md`
- US-SLD-090-class-css-import-coordinate-parity-regression — `.github/oliver-app/modules/slides-module/US-SLD-090-class-css-import-coordinate-parity-regression.md`
- US-SLD-101-robust-html-input-intake — `.github/oliver-app/modules/slides-module/US-SLD-101-robust-html-input-intake.md`
- US-SLD-102-multi-root-and-fragment-normalization — `.github/oliver-app/modules/slides-module/US-SLD-102-multi-root-and-fragment-normalization.md`
- US-SLD-103-css-cascade-and-external-styles-resolution — `.github/oliver-app/modules/slides-module/US-SLD-103-css-cascade-and-external-styles-resolution.md`
- US-SLD-104-fallback-safety-for-unsupported-nodes — `.github/oliver-app/modules/slides-module/US-SLD-104-fallback-safety-for-unsupported-nodes.md`
- US-SLD-111-editable-layer-reconstruction — `.github/oliver-app/modules/slides-module/US-SLD-111-editable-layer-reconstruction.md`
- US-SLD-112-precision-manipulation-move-resize-align-distribute — `.github/oliver-app/modules/slides-module/US-SLD-112-precision-manipulation-move-resize-align-distribute.md`
- US-SLD-113-inline-text-and-style-editing — `.github/oliver-app/modules/slides-module/US-SLD-113-inline-text-and-style-editing.md`
- US-SLD-114-layer-grouping-z-order-and-lock-semantics — `.github/oliver-app/modules/slides-module/US-SLD-114-layer-grouping-z-order-and-lock-semantics.md`
- US-SLD-121-canvas-target-presets-custom-sizes — `.github/oliver-app/modules/slides-module/US-SLD-121-canvas-target-presets-custom-sizes.md`
- US-SLD-122-intelligent-reflow-reposition-rules — `.github/oliver-app/modules/slides-module/US-SLD-122-intelligent-reflow-reposition-rules.md`
- US-SLD-123-crop-workflow-and-safe-bounds — `.github/oliver-app/modules/slides-module/US-SLD-123-crop-workflow-and-safe-bounds.md`
- US-SLD-131-pptx-native-object-priority — `.github/oliver-app/modules/slides-module/US-SLD-131-pptx-native-object-priority.md`
- US-SLD-132-multi-slide-export-orchestration — `.github/oliver-app/modules/slides-module/US-SLD-132-multi-slide-export-orchestration.md`
- US-SLD-133-format-parity-html-pdf-reveal-js — `.github/oliver-app/modules/slides-module/US-SLD-133-format-parity-html-pdf-reveal-js.md`
- US-SLD-141-autosave-retry-budget-degraded-mode — `.github/oliver-app/modules/slides-module/US-SLD-141-autosave-retry-budget-degraded-mode.md`
- US-SLD-142-revision-conflict-resolution — `.github/oliver-app/modules/slides-module/US-SLD-142-revision-conflict-resolution.md`
- US-SLD-143-template-acl-ownership-transfer-and-approval-sla — `.github/oliver-app/modules/slides-module/US-SLD-143-template-acl-ownership-transfer-and-approval-sla.md`
- US-SLD-151-fe-orchestrator-decomposition-completion — `.github/oliver-app/modules/slides-module/US-SLD-151-fe-orchestrator-decomposition-completion.md`
- US-SLD-152-be-router-decomposition-completion — `.github/oliver-app/modules/slides-module/US-SLD-152-be-router-decomposition-completion.md`
- US-SLD-153-stable-harness-and-release-gates — `.github/oliver-app/modules/slides-module/US-SLD-153-stable-harness-and-release-gates.md`
- US-SLD-156-frontend-interaction-inventory-and-click-path-enforcement — `.github/oliver-app/modules/slides-module/US-SLD-156-frontend-interaction-inventory-and-click-path-enforcement.md`
- US-SLD-157-expert-visual-design-quality-gate — `.github/oliver-app/modules/slides-module/US-SLD-157-expert-visual-design-quality-gate.md`
- US-SLD-160-archive-activity-workspace-with-safe-reactivation-path — `.github/oliver-app/modules/slides-module/US-SLD-160-archive-activity-workspace-with-safe-reactivation-path.md`

## Active repair candidates

These are the only stories that should be considered current repair work before human review.

- Slides QA Audit Snapshot (2026-04-27) — `.github/oliver-app/modules/slides-module/QA-2026-04-27.md`
- SLD-QA-621-check-user-stories-root-resolution-and-slides-coverage — `.github/oliver-app/modules/slides-module/SLD-QA-621-check-user-stories-root-resolution-and-slides-coverage.md`

## Current truth candidates needing review

These were previously classified as current build truth but are not obvious source-of-truth docs or completed verified stories.

TBD.

## Needs manual review

TBD.

## Next candidates

TBD.

## Parked

TBD.

## Superseded / historical candidates

TBD.

## Evidence-only candidates

- SLD-BE-150-unsaved-change-telemetry-ingestion-and-metrics-contract — `.github/oliver-app/modules/slides-module/SLD-BE-150-unsaved-change-telemetry-ingestion-and-metrics-contract.md`
- SLD-BE-210-template-preview-assets-and-indexing-contract — `.github/oliver-app/modules/slides-module/SLD-BE-210-template-preview-assets-and-indexing-contract.md`
- SLD-BE-410-template-ownership-transfer-contract — `.github/oliver-app/modules/slides-module/SLD-BE-410-template-ownership-transfer-contract.md`
- SLD-BE-430-long-range-audit-export-jobs-and-presets-contract — `.github/oliver-app/modules/slides-module/SLD-BE-430-long-range-audit-export-jobs-and-presets-contract.md`
- SLD-BE-440-template-approval-sla-and-escalation-automation — `.github/oliver-app/modules/slides-module/SLD-BE-440-template-approval-sla-and-escalation-automation.md`
- SLD-BE-500-pptx-native-object-generation-service — `.github/oliver-app/modules/slides-module/SLD-BE-500-pptx-native-object-generation-service.md`
- SLD-BE-510-pptx-async-export-job-orchestration — `.github/oliver-app/modules/slides-module/SLD-BE-510-pptx-async-export-job-orchestration.md`
- SLD-BE-620-slides-api-router-decomposition-and-fe-be-contract-seam-hardening — `.github/oliver-app/modules/slides-module/SLD-BE-620-slides-api-router-decomposition-and-fe-be-contract-seam-hardening.md`
- SLD-FE-150-unsaved-change-risk-telemetry-and-discard-analytics — `.github/oliver-app/modules/slides-module/SLD-FE-150-unsaved-change-risk-telemetry-and-discard-analytics.md`
- SLD-FE-210-template-library-thumbnail-and-preview-picker — `.github/oliver-app/modules/slides-module/SLD-FE-210-template-library-thumbnail-and-preview-picker.md`
- SLD-FE-310-style-cascade-order-preservation-for-imported-html — `.github/oliver-app/modules/slides-module/SLD-FE-310-style-cascade-order-preservation-for-imported-html.md`
- SLD-FE-340-canvas-snapping-guides-and-precision-layout — `.github/oliver-app/modules/slides-module/SLD-FE-340-canvas-snapping-guides-and-precision-layout.md`
- SLD-FE-410-template-ownership-transfer-controls — `.github/oliver-app/modules/slides-module/SLD-FE-410-template-ownership-transfer-controls.md`
- SLD-FE-430-activity-filter-presets-and-saved-views — `.github/oliver-app/modules/slides-module/SLD-FE-430-activity-filter-presets-and-saved-views.md`
- SLD-FE-440-approval-aging-sla-signal-and-escalation-ui — `.github/oliver-app/modules/slides-module/SLD-FE-440-approval-aging-sla-signal-and-escalation-ui.md`
- SLD-FE-500-pptx-export-ux-single-and-multi-slide — `.github/oliver-app/modules/slides-module/SLD-FE-500-pptx-export-ux-single-and-multi-slide.md`
- SLD-FE-610-slides-page-orchestrator-decomposition — `.github/oliver-app/modules/slides-module/SLD-FE-610-slides-page-orchestrator-decomposition.md`
- SLD-FE-615-slides-chatbot-edit-and-workspace-flow-parity — `.github/oliver-app/modules/slides-module/SLD-FE-615-slides-chatbot-edit-and-workspace-flow-parity.md`
- SLD-FE-616-slides-shell-cross-module-design-parity — `.github/oliver-app/modules/slides-module/SLD-FE-616-slides-shell-cross-module-design-parity.md`
- SLD-FE-617-slides-degraded-mode-critical-endpoint-scoping — `.github/oliver-app/modules/slides-module/SLD-FE-617-slides-degraded-mode-critical-endpoint-scoping.md`
- SLD-FE-620-slides-page-orchestrator-phase-2-decomposition — `.github/oliver-app/modules/slides-module/SLD-FE-620-slides-page-orchestrator-phase-2-decomposition.md`
- SLD-QA-610-slides-long-run-e2e-stability-harness — `.github/oliver-app/modules/slides-module/SLD-QA-610-slides-long-run-e2e-stability-harness.md`
- SLD-QA-611-slides-chatbot-command-flow-contract-gate — `.github/oliver-app/modules/slides-module/SLD-QA-611-slides-chatbot-command-flow-contract-gate.md`
- SLD-QA-612-slides-mobile-click-path-and-overflow-certification — `.github/oliver-app/modules/slides-module/SLD-QA-612-slides-mobile-click-path-and-overflow-certification.md`
- SLD-QA-613-slides-journey-depth-matrix-and-parity-audit — `.github/oliver-app/modules/slides-module/SLD-QA-613-slides-journey-depth-matrix-and-parity-audit.md`
- SLD-QA-615-slides-chatbot-fuzzy-matching-and-cross-module-path-guards — `.github/oliver-app/modules/slides-module/SLD-QA-615-slides-chatbot-fuzzy-matching-and-cross-module-path-guards.md`
- SLD-QA-622-slides-stable-harness-reproducibility-and-auth-bootstrap-hardening — `.github/oliver-app/modules/slides-module/SLD-QA-622-slides-stable-harness-reproducibility-and-auth-bootstrap-hardening.md`
- SLD-QA-623-navigation-retry-hardening-for-transient-webserver-dropouts — `.github/oliver-app/modules/slides-module/SLD-QA-623-navigation-retry-hardening-for-transient-webserver-dropouts.md`
- SLD-QA-625-slides-browser-capable-full-regression-and-interaction-certification — `.github/oliver-app/modules/slides-module/SLD-QA-625-slides-browser-capable-full-regression-and-interaction-certification.md`
- SLD-QA-626-slides-supabase-import-trace-backfill-audit-and-remediation — `.github/oliver-app/modules/slides-module/SLD-QA-626-slides-supabase-import-trace-backfill-audit-and-remediation.md`
- SLD-TECH-311-style-order-regression-coverage — `.github/oliver-app/modules/slides-module/SLD-TECH-311-style-order-regression-coverage.md`
- SLD-TECH-630-slides-contract-gate-behavioral-hardening — `.github/oliver-app/modules/slides-module/SLD-TECH-630-slides-contract-gate-behavioral-hardening.md`
- SMK-SLD-001-unsupported-unit-warning-contract — `.github/oliver-app/modules/slides-module/SMK-SLD-001-unsupported-unit-warning-contract.md`
- SMK-SLD-002-coordinate-normalization-expected-value-drift — `.github/oliver-app/modules/slides-module/SMK-SLD-002-coordinate-normalization-expected-value-drift.md`
- US-SLD-001-backfill-slides-shell-and-access-contract — `.github/oliver-app/modules/slides-module/US-SLD-001-backfill-slides-shell-and-access-contract.md`
- US-SLD-002-backfill-html-import-command-and-flow-contract — `.github/oliver-app/modules/slides-module/US-SLD-002-backfill-html-import-command-and-flow-contract.md`
- US-SLD-005-include-slides-in-coverage-and-verification-audits — `.github/oliver-app/modules/slides-module/US-SLD-005-include-slides-in-coverage-and-verification-audits.md`
- US-SLD-010-import-preflight-validation-and-guardrails — `.github/oliver-app/modules/slides-module/US-SLD-010-import-preflight-validation-and-guardrails.md`
- US-SLD-011-structured-import-results-and-warning-ux — `.github/oliver-app/modules/slides-module/US-SLD-011-structured-import-results-and-warning-ux.md`
- US-SLD-012-import-progress-feedback-and-cancelability — `.github/oliver-app/modules/slides-module/US-SLD-012-import-progress-feedback-and-cancelability.md`
- US-SLD-021-selection-drag-resize-and-keyboard-nudge — `.github/oliver-app/modules/slides-module/US-SLD-021-selection-drag-resize-and-keyboard-nudge.md`
- US-SLD-022-inline-text-editing-and-style-toolbar — `.github/oliver-app/modules/slides-module/US-SLD-022-inline-text-editing-and-style-toolbar.md`
- US-SLD-023-multi-select-alignment-and-distribution-tools — `.github/oliver-app/modules/slides-module/US-SLD-023-multi-select-alignment-and-distribution-tools.md`
- US-SLD-024-undo-redo-history-for-editing-actions — `.github/oliver-app/modules/slides-module/US-SLD-024-undo-redo-history-for-editing-actions.md`
- US-SLD-025-accessible-keyboard-first-slide-editing — `.github/oliver-app/modules/slides-module/US-SLD-025-accessible-keyboard-first-slide-editing.md`
- US-SLD-026-visual-regression-screenshot-baseline — `.github/oliver-app/modules/slides-module/US-SLD-026-visual-regression-screenshot-baseline.md`
- US-SLD-027-locked-layer-guardrails — `.github/oliver-app/modules/slides-module/US-SLD-027-locked-layer-guardrails.md`
- US-SLD-028-library-search-empty-state-and-template-visibility-hardening — `.github/oliver-app/modules/slides-module/US-SLD-028-library-search-empty-state-and-template-visibility-hardening.md`
- US-SLD-029-chat-command-parity-and-flow-runtime-guardrails — `.github/oliver-app/modules/slides-module/US-SLD-029-chat-command-parity-and-flow-runtime-guardrails.md`
- US-SLD-031-save-api-and-autosave-state-contract — `.github/oliver-app/modules/slides-module/US-SLD-031-save-api-and-autosave-state-contract.md`
- US-SLD-032-template-library-and-my-slides-fe-be-wiring — `.github/oliver-app/modules/slides-module/US-SLD-032-template-library-and-my-slides-fe-be-wiring.md`
- US-SLD-034-revision-conflict-and-crash-recovery — `.github/oliver-app/modules/slides-module/US-SLD-034-revision-conflict-and-crash-recovery.md`
- US-SLD-035-slide-operation-audit-log-and-telemetry — `.github/oliver-app/modules/slides-module/US-SLD-035-slide-operation-audit-log-and-telemetry.md`
- US-SLD-036-slides-fe-be-integration-and-regression-suite — `.github/oliver-app/modules/slides-module/US-SLD-036-slides-fe-be-integration-and-regression-suite.md`
- US-SLD-037-unsaved-change-guardrails-for-workspace-navigation — `.github/oliver-app/modules/slides-module/US-SLD-037-unsaved-change-guardrails-for-workspace-navigation.md`
- US-SLD-038-scoped-draft-recovery-lifecycle-for-unsaved-edits — `.github/oliver-app/modules/slides-module/US-SLD-038-scoped-draft-recovery-lifecycle-for-unsaved-edits.md`
- US-SLD-039-autosave-retry-queue-and-backoff-controls — `.github/oliver-app/modules/slides-module/US-SLD-039-autosave-retry-queue-and-backoff-controls.md`
- US-SLD-040-chat-driven-html-export-download — `.github/oliver-app/modules/slides-module/US-SLD-040-chat-driven-html-export-download.md`
- US-SLD-055-html-upload-and-paste-intake-validation — `.github/oliver-app/modules/slides-module/US-SLD-055-html-upload-and-paste-intake-validation.md`
- US-SLD-056-import-warning-taxonomy-and-fallback-reporting — `.github/oliver-app/modules/slides-module/US-SLD-056-import-warning-taxonomy-and-fallback-reporting.md`
- US-SLD-060-template-system-for-reuse-and-locking — `.github/oliver-app/modules/slides-module/US-SLD-060-template-system-for-reuse-and-locking.md`
- US-SLD-061-theme-system-for-brand-application — `.github/oliver-app/modules/slides-module/US-SLD-061-theme-system-for-brand-application.md`
- US-SLD-062-layout-aware-editing-constraints-foundation — `.github/oliver-app/modules/slides-module/US-SLD-062-layout-aware-editing-constraints-foundation.md`
- US-SLD-064-advanced-import-resilience-v2 — `.github/oliver-app/modules/slides-module/US-SLD-064-advanced-import-resilience-v2.md`
- US-SLD-080-dom-to-pptx-computed-style-mapping-foundation — `.github/oliver-app/modules/slides-module/US-SLD-080-dom-to-pptx-computed-style-mapping-foundation.md`
- US-SLD-081-flexbox-layout-resolution-parity-for-pptx — `.github/oliver-app/modules/slides-module/US-SLD-081-flexbox-layout-resolution-parity-for-pptx.md`
- US-SLD-082-gradient-shadow-radius-fidelity-in-pptx — `.github/oliver-app/modules/slides-module/US-SLD-082-gradient-shadow-radius-fidelity-in-pptx.md`
- US-SLD-083-no-screenshot-fallback-and-editable-output-guardrails — `.github/oliver-app/modules/slides-module/US-SLD-083-no-screenshot-fallback-and-editable-output-guardrails.md`
- US-SLD-084-auto-font-embedding-for-pptx-export — `.github/oliver-app/modules/slides-module/US-SLD-084-auto-font-embedding-for-pptx-export.md`
- US-SLD-085-html-fragment-to-native-pptx-animation-mapping — `.github/oliver-app/modules/slides-module/US-SLD-085-html-fragment-to-native-pptx-animation-mapping.md`
- US-SLD-086-svg-table-canvas-dashboard-export-parity — `.github/oliver-app/modules/slides-module/US-SLD-086-svg-table-canvas-dashboard-export-parity.md`
- US-SLD-091-add-persistent-syncing-notice-for-slides-library-and-save-lifecycle — `.github/oliver-app/modules/slides-module/US-SLD-091-add-persistent-syncing-notice-for-slides-library-and-save-lifecycle.md`
- US-SLD-115-powerpoint-style-editor-surface-and-color-controls — `.github/oliver-app/modules/slides-module/US-SLD-115-powerpoint-style-editor-surface-and-color-controls.md`
- US-SLD-124-slides-editor-qa-completion-gate — `.github/oliver-app/modules/slides-module/US-SLD-124-slides-editor-qa-completion-gate.md`
- US-SLD-154-fix-deploy-blocking-import-ingestion-types-contract — `.github/oliver-app/modules/slides-module/US-SLD-154-fix-deploy-blocking-import-ingestion-types-contract.md`
- US-SLD-155-restore-pptx-export-build-dependency-contract — `.github/oliver-app/modules/slides-module/US-SLD-155-restore-pptx-export-build-dependency-contract.md`
- US-SLD-158-import-attachment-diagnostics-and-no-op-guardrails — `.github/oliver-app/modules/slides-module/US-SLD-158-import-attachment-diagnostics-and-no-op-guardrails.md`
- US-SLD-159-import-observability-and-supabase-verification-handshake — `.github/oliver-app/modules/slides-module/US-SLD-159-import-observability-and-supabase-verification-handshake.md`
- US-SLD-161-slides-epic-mapping-and-test-suite-governance-cleanup — `.github/oliver-app/modules/slides-module/US-SLD-161-slides-epic-mapping-and-test-suite-governance-cleanup.md`

## Open questions

- Are the two active repair candidates still valid after the latest Slides redesign direction?
- Which export formats are required for the next release versus preserved as completed capability?
- Which diagnostics belong in the main workspace versus secondary tabs?

## Agent execution instruction

Before changing this module, read this file first.

Do not treat every story in `.github/oliver-app/modules/slides-module` as current product direction.

Read the source-of-truth documents first.

Use active repair stories only when they are listed in this document and still reproduce in the current app.

Treat Done/Verified stories as completed capability or evidence unless current behavior contradicts them.

Do not rebuild deprecated routes, old screens, removed workflows, or historical behavior.