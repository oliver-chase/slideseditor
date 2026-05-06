export function createGetResourceHandlers(deps) {
  return {
    'slides': (context) => deps.handleGetSlidesResource(context),
    'templates': (context) => deps.handleGetTemplatesResource(context),
    'archived-templates': (context) => deps.handleGetArchivedTemplatesResource(context),
    'template-collaborators': (context) => deps.handleGetTemplateCollaboratorsResource(context),
    'template-approvals': (context) => deps.handleGetTemplateApprovalsResource(context),
    'audit-presets': (context) => deps.handleGetAuditPresetsResource(context),
    'audit-export-jobs': (context) => deps.handleGetAuditExportJobsResource(context),
    'pptx-export-jobs': (context) => deps.handleGetPptxExportJobsResource(context),
    'telemetry-summary': (context) => deps.handleGetTelemetrySummaryResource(context),
    'import-session-traces': (context) => deps.handleGetImportSessionTracesResource(context),
    'audits': (context) => deps.handleGetAuditsResource(context),
  };
}
