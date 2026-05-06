# Slides Action-To-Table And RLS Matrix

Last updated: 2026-05-03

This is the canonical governance map for `/api/slides`. The dispatch source of truth is `functions/api/slides/route-handler-groups.js`; handler implementations live in `functions/api/slides.js`; frontend callers live primarily in `src/lib/slides.ts`.

## RLS Model

All persistent Slides tables in the exposed `public` schema must have RLS enabled and deny direct `anon` / `authenticated` access. Browser clients do not call Supabase tables directly. The Cloudflare Function uses the Supabase service role and enforces ownership, role, collaboration, approval, and visibility rules in `functions/api/slides.js`.

Current persistent Slides tables:

| Table | Migration | RLS expectation |
| --- | --- | --- |
| `slides` | `003_slides_platform.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend enforces owner/admin reads and writes. |
| `slide_templates` | `003_slides_platform.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend enforces shared, owner, admin, and collaborator visibility. |
| `slide_audit_events` | `003_slides_platform.sql`, `005`, `006`, `007`, `008`, `009` | RLS enabled; deny all direct `anon` / `authenticated`; backend scopes reads by actor unless admin. |
| `slide_template_collaborators` | `006_slide_template_collaborators.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend limits management to owner/admin. |
| `slide_template_approvals` | `007_slide_template_approvals.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend limits requests/resolution/escalation by role. |
| `slide_audit_filter_presets` | `008_slide_audit_filter_presets.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend scopes personal/shared presets. |
| `slide_audit_export_jobs` | `010_slide_audit_export_jobs.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend scopes jobs by requester unless admin. |
| `slide_import_session_traces` | `018_slide_import_session_traces.sql` | RLS enabled; deny all direct `anon` / `authenticated`; backend persists trace rows and scopes reads by actor unless admin. |

`pptx-export-jobs` and unsaved-change telemetry are currently process-memory stores in `functions/api/slides.js`. They still pass through `/api/slides` actor authorization, but they do not have a Supabase RLS policy until a future persistence migration exists.

## GET Resource Matrix

| GET resource | Handler | Frontend caller | Tables / stores | Columns and filters | Policy and side effects |
| --- | --- | --- | --- | --- | --- |
| `slides` | `handleGetSlidesResource` | `listSlides` | `slides` | `deleted_at is null`, `title` search, `owner_user_id` for non-admin, ordered by `updated_at` | Admin sees all active slides; non-admin sees owned slides only. |
| `templates` | `handleGetTemplatesResource` | `listTemplates` | `slide_templates`, `slide_template_collaborators` | `is_archived=false`, `name` search, shared/owner/collaborator visibility | Admin sees all active templates; non-admin sees shared, owned, or collaborator templates. |
| `archived-templates` | `handleGetArchivedTemplatesResource` | `listArchivedTemplates` | `slide_templates` | `is_archived=true`, `name` search, `owner_user_id` for non-admin | Admin sees all archived templates; non-admin sees owned archived templates. |
| `template-collaborators` | `handleGetTemplateCollaboratorsResource` | `listTemplateCollaborators` | `slide_templates`, `slide_template_collaborators`, `app_users` | `template_id`, collaborator `user_id`, `role` | Actor must be able to see the template; emails are hydrated from app users. |
| `template-approvals` | `handleGetTemplateApprovalsResource` | `listTemplateApprovals` | `slide_template_approvals` | Optional `template_id`, `status`, pagination; requester filter for non-admin | Admin sees approval queue; non-admin sees requests they submitted. |
| `audit-presets` | `handleGetAuditPresetsResource` | `listAuditPresets` | `slide_audit_filter_presets` | `is_archived=false`, `scope=shared OR owner_user_id=actor` | Personal presets are owner scoped; shared presets are readable through backend. |
| `audit-export-jobs` | `handleGetAuditExportJobsResource` | `listAuditExportJobs` | `slide_audit_export_jobs` | Optional `status`, pagination, requester filter for non-admin | Admin sees all jobs; non-admin sees requested jobs only. |
| `pptx-export-jobs` | `handleGetPptxExportJobsResource` | `listPptxExportJobs` | Process-memory `pptxExportJobsById` | Optional `status`, pagination | Actor must be requester unless admin. No Supabase RLS table yet. |
| `telemetry-summary` | `handleGetTelemetrySummaryResource` | `getUnsavedTelemetrySummary` | Process-memory `unsavedTelemetryEvents` | `from`, `to`, actor filter for non-admin | Returns aggregate discard/retry/prompt rates; no persistent table yet. |
| `import-session-traces` | `handleGetImportSessionTracesResource` | `getImportSessionTraces` | `slide_import_session_traces` | Optional `correlation_id`, `actor_user_id` for non-admin, capped `max` | Admin may inspect any trace; non-admin sees owned traces. |
| `audits` | `handleGetAuditsResource` | `listSlideAudits` | `slide_audit_events` | `action`, `outcome`, `entity_type`, `date_from`, `date_to`, search, pagination, actor filter for non-admin | Admin sees all audit rows; non-admin sees own audit rows. |

## POST Action Matrix

| POST action | Handler | Frontend caller | Tables / stores | Columns mutated or read | Policy, failures, and side effects |
| --- | --- | --- | --- | --- | --- |
| `save` | `handleSaveAction` | `saveSlide` | `slides`, `slide_audit_events` | Insert/update `title`, `canvas`, `components_json`, `metadata`, `revision`, `source`, `source_template_id`, `created_by`, `updated_by`, `last_edited_at`; audit `save`/`autosave` | Owner/admin update only; expected revision conflicts return 409 and write failure audit. |
| `duplicate-slide` | `handleDuplicateSlideAction` | `duplicateSlide` | `slides`, `slide_audit_events` | Reads source slide; inserts copied slide; audit `duplicate` | Source must exist and be owned by actor unless admin. |
| `rename-slide` | `handleRenameSlideAction` | `renameSlide` | `slides`, `slide_audit_events` | Updates `title`, `revision`, `updated_by`, `last_edited_at`; audit `rename` | Owner/admin only; validates non-empty title. |
| `delete-slide` | `handleDeleteSlideAction` | `deleteSlide` | `slides`, `slide_audit_events` | Soft-delete via `deleted_at`, bumps `revision`; audit `delete` | Owner/admin only. |
| `duplicate-template` | `handleDuplicateTemplateAction` | `duplicateTemplateAsSlide` | `slide_templates`, `slide_template_collaborators`, `slides`, `slide_audit_events` | Reads visible template; inserts slide with `source='template'` and template metadata; audit `duplicate` | Template must be shared, owned, collaborator-visible, or admin-visible. |
| `publish-template` | `handlePublishTemplateAction` | `publishTemplateFromSlide` | `slides`, `slide_templates`, `slide_audit_events` | Reads slide; inserts template; patches preview metadata; audit `publish-template` | Source slide owner/admin; shared publication requires admin. |
| `refresh-template-preview` | `handleRefreshTemplatePreviewAction` | `refreshTemplatePreview` | `slide_templates` | Patches `metadata.preview`, `updated_by`, `updated_at` | Owner/admin only. |
| `update-template` | `handleUpdateTemplateAction` | `updateTemplate` | `slide_templates`, `slide_template_collaborators`, `slide_audit_events` | Updates `name`, `description`, `is_shared`, `updated_by`; audit `rename` with `operation=update-template` | Owner/admin/editor can edit content; visibility changes owner/admin only; shared true admin only. |
| `archive-template` | `handleArchiveTemplateAction` | `archiveTemplate` | `slide_templates`, `slide_audit_events` | Sets `is_archived=true`; audit `delete` with `operation=archive-template` | Owner/admin only. |
| `restore-template` | `handleRestoreTemplateAction` | `restoreTemplate` | `slide_templates`, `slide_audit_events` | Sets `is_archived=false`; audit `delete` with `operation=restore-template` | Owner/admin only. |
| `permanent-delete-template` | `handlePermanentDeleteTemplateAction` | `permanentlyDeleteTemplate` | `slide_template_collaborators`, `slide_templates`, `slide_audit_events` | Deletes collaborators and archived template; audit `delete` with `operation=permanent-delete-template` | Owner/admin only; template must already be archived. |
| `transfer-template-owner` | `handleTransferTemplateOwnershipAction` | `transferTemplateOwnership` | `slide_templates`, `slide_template_collaborators`, `app_users`, `slide_audit_events` | Deletes target collaborator row; updates `owner_user_id`; audit `transfer-template` | Owner/admin only; target must exist and have Slides access. |
| `upsert-template-collaborator` | `handleUpsertTemplateCollaboratorAction` | `upsertTemplateCollaborator` | `slide_templates`, `slide_template_collaborators`, `app_users`, `slide_audit_events` | Upserts `role`, `created_by`, `updated_by`; audit `upsert-collaborator` | Owner/admin only; target must exist, have Slides access, and not be owner. |
| `remove-template-collaborator` | `handleRemoveTemplateCollaboratorAction` | `removeTemplateCollaborator` | `slide_templates`, `slide_template_collaborators`, `app_users`, `slide_audit_events` | Deletes collaborator row; audit `remove-collaborator` | Owner/admin only. |
| `submit-template-approval` | `handleSubmitTemplateApprovalAction` | `submitTemplateApproval` | `slide_templates`, `slide_template_approvals`, `app_users`, `slide_audit_events` | Inserts approval with `approval_type`, `payload`, `status='pending'`; audit `submit-approval` | Owner/admin only; target must have Slides access. |
| `resolve-template-approval` | `handleResolveTemplateApprovalAction` | `resolveTemplateApproval` | `slide_template_approvals`, plus delegated governance action tables, `slide_audit_events` | On reject patches `status`, reviewer fields; on approve executes transfer/upsert/remove then patches approval; audits approve/reject | Admin only; pending approvals only. |
| `escalate-template-approval` | `handleEscalateTemplateApprovalAction` | `escalateTemplateApproval` | `slide_template_approvals`, `slide_templates`, `slide_audit_events` | Appends escalation payload; audit `escalate-approval` | Requester, template owner, or admin only; pending approvals only. |
| `run-approval-escalation-sweep` | `handleRunApprovalEscalationSweepAction` | `runApprovalEscalationSweep` | `slide_template_approvals`, `slide_audit_events` | Reads overdue pending approvals; patches escalation payload; writes sweep audits/heartbeat | Admin or valid scheduled job token only. |
| `upsert-audit-preset` | `handleUpsertAuditPresetAction` | `upsertAuditPreset` | `slide_audit_filter_presets` | Inserts/updates preset filters, scope, dates, `created_by`, `updated_by` | Personal owner-scoped; shared create/update admin only. |
| `delete-audit-preset` | `handleDeleteAuditPresetAction` | `deleteAuditPreset` | `slide_audit_filter_presets` | Soft-delete via `is_archived=true`, `updated_by`, `updated_at` | Owner/admin for personal; shared delete admin only. |
| `request-audit-export-job` | `handleRequestAuditExportJobAction` | `requestAuditExportJob` | `slide_audit_export_jobs`, `slide_audit_events` | Inserts running job; reads filtered audits; patches `status`, `row_count`, `file_name`, `csv_content`, `completed_at` or failure | Non-admin export rows are actor-scoped. |
| `download-audit-export-job` | `handleDownloadAuditExportJobAction` | `downloadAuditExportJob` | `slide_audit_export_jobs` | Reads completed `csv_content` and `file_name` | Requester/admin only; job must be completed. |
| `record-export` | `handleRecordExportAction` | HTML/PDF/PPTX export hooks | `slide_audit_events` | Inserts `export-html`, `export-pdf`, or `export-pptx` audit row | Requires `slide_id`; audit insert is the durable side effect. |
| `request-pptx-export-job` | `handleRequestPptxExportJobAction` | `requestPptxExportJob` | `slides`, process-memory `pptxExportJobsById`, `slide_audit_events` | Reads persisted slide IDs for ownership; stores generated job in memory; audit `export-pptx` per slide | Persisted slide IDs must be owned by actor unless admin; no Supabase export-job table yet. |
| `download-pptx-export-job` | `handleDownloadPptxExportJobAction` | `downloadPptxExportJob` | Process-memory `pptxExportJobsById` | Reads generated job artifact metadata | Requester/admin only; job must be succeeded and not expired. |
| `record-telemetry` | `handleRecordTelemetryAction` | `recordUnsavedTelemetryEvent` | Process-memory `unsavedTelemetryEvents` | Appends unsaved-change telemetry envelope | Schema validates event type, tab, save status, and trigger source; no Supabase table yet. |
| `record-import-session-trace` | `handleRecordImportSessionTraceAction` | `recordImportSessionTrace` | `slide_import_session_traces` | Inserts `correlation_id`, actor, `phase`, `source`, `taxonomy_buckets`, `counters`, `duration_ms`, error fields | Persists parse lifecycle source attribution; frontend calls are fire-and-forget so trace failures do not block import UX. |

## Update Gate

Any change to `buildGetResourceHandlers` or `buildPostActionHandlers` must update this matrix in the same change set. `tests/contracts/slides-api-router-decomposition.contract.test.mjs` enforces that every active GET resource and POST action appears here.
