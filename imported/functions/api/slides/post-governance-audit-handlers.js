export function createPostGovernanceAuditHandlers(deps) {
  return {
    'publish-template': (env, actor, body) => deps.handlePublishTemplateAction(env, actor, body),
    'refresh-template-preview': (env, actor, body) => deps.handleRefreshTemplatePreviewAction(env, actor, body),
    'update-template': (env, actor, body) => deps.handleUpdateTemplateAction(env, actor, body),
    'archive-template': (env, actor, body) => deps.handleArchiveTemplateAction(env, actor, body),
    'restore-template': (env, actor, body) => deps.handleRestoreTemplateAction(env, actor, body),
    'permanent-delete-template': (env, actor, body) => deps.handlePermanentDeleteTemplateAction(env, actor, body),
    'transfer-template-owner': (env, actor, body) => deps.handleTransferTemplateOwnershipAction(env, actor, body),
    'upsert-template-collaborator': (env, actor, body) => deps.handleUpsertTemplateCollaboratorAction(env, actor, body),
    'remove-template-collaborator': (env, actor, body) => deps.handleRemoveTemplateCollaboratorAction(env, actor, body),
    'submit-template-approval': (env, actor, body) => deps.handleSubmitTemplateApprovalAction(env, actor, body),
    'resolve-template-approval': (env, actor, body) => deps.handleResolveTemplateApprovalAction(env, actor, body),
    'escalate-template-approval': (env, actor, body) => deps.handleEscalateTemplateApprovalAction(env, actor, body),
    'run-approval-escalation-sweep': (env, actor, body) => deps.handleRunApprovalEscalationSweepAction(env, actor, body),
    'upsert-audit-preset': (env, actor, body) => deps.handleUpsertAuditPresetAction(env, actor, body),
    'delete-audit-preset': (env, actor, body) => deps.handleDeleteAuditPresetAction(env, actor, body),
    'request-audit-export-job': (env, actor, body) => deps.handleRequestAuditExportJobAction(env, actor, body),
    'download-audit-export-job': (env, actor, body) => deps.handleDownloadAuditExportJobAction(env, actor, body),
  };
}
