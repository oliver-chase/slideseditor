export function buildGetResourceHandlers(handlers) {
  const slidesResources = {
    'slides': handlers.handleGetSlidesResource,
    'templates': handlers.handleGetTemplatesResource,
    'archived-templates': handlers.handleGetArchivedTemplatesResource,
  };

  const governanceResources = {
    'template-collaborators': handlers.handleGetTemplateCollaboratorsResource,
    'template-approvals': handlers.handleGetTemplateApprovalsResource,
  };

  const auditResources = {
    'audit-presets': handlers.handleGetAuditPresetsResource,
    'audit-export-jobs': handlers.handleGetAuditExportJobsResource,
    'audits': handlers.handleGetAuditsResource,
  };

  const exportResources = {
    'pptx-export-jobs': handlers.handleGetPptxExportJobsResource,
  };

  const telemetryResources = {
    'telemetry-summary': handlers.handleGetTelemetrySummaryResource,
    'import-session-traces': handlers.handleGetImportSessionTracesResource,
  };

  return {
    ...slidesResources,
    ...governanceResources,
    ...auditResources,
    ...exportResources,
    ...telemetryResources,
  };
}

export function buildPostActionHandlers(handlers) {
  const slidesActions = {
    'save': handlers.handleSaveAction,
    'duplicate-slide': handlers.handleDuplicateSlideAction,
    'rename-slide': handlers.handleRenameSlideAction,
    'delete-slide': handlers.handleDeleteSlideAction,
  };

  const templateActions = {
    'duplicate-template': handlers.handleDuplicateTemplateAction,
    'publish-template': handlers.handlePublishTemplateAction,
    'refresh-template-preview': handlers.handleRefreshTemplatePreviewAction,
    'update-template': handlers.handleUpdateTemplateAction,
    'archive-template': handlers.handleArchiveTemplateAction,
    'restore-template': handlers.handleRestoreTemplateAction,
    'permanent-delete-template': handlers.handlePermanentDeleteTemplateAction,
  };

  const governanceActions = {
    'transfer-template-owner': handlers.handleTransferTemplateOwnershipAction,
    'upsert-template-collaborator': handlers.handleUpsertTemplateCollaboratorAction,
    'remove-template-collaborator': handlers.handleRemoveTemplateCollaboratorAction,
    'submit-template-approval': handlers.handleSubmitTemplateApprovalAction,
    'resolve-template-approval': handlers.handleResolveTemplateApprovalAction,
    'escalate-template-approval': handlers.handleEscalateTemplateApprovalAction,
    'run-approval-escalation-sweep': handlers.handleRunApprovalEscalationSweepAction,
  };

  const auditActions = {
    'upsert-audit-preset': handlers.handleUpsertAuditPresetAction,
    'delete-audit-preset': handlers.handleDeleteAuditPresetAction,
    'request-audit-export-job': handlers.handleRequestAuditExportJobAction,
    'download-audit-export-job': handlers.handleDownloadAuditExportJobAction,
    'record-export': handlers.handleRecordExportAction,
  };

  const exportActions = {
    'request-pptx-export-job': handlers.handleRequestPptxExportJobAction,
    'download-pptx-export-job': handlers.handleDownloadPptxExportJobAction,
  };

  const telemetryActions = {
    'record-telemetry': handlers.handleRecordTelemetryAction,
    'record-import-session-trace': handlers.handleRecordImportSessionTraceAction,
  };

  return {
    ...slidesActions,
    ...templateActions,
    ...governanceActions,
    ...auditActions,
    ...exportActions,
    ...telemetryActions,
  };
}
