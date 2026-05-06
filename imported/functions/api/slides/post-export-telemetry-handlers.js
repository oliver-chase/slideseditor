export function createPostExportTelemetryHandlers(deps) {
  return {
    'request-pptx-export-job': (env, actor, body) => deps.handleRequestPptxExportJobAction(env, actor, body),
    'download-pptx-export-job': (env, actor, body) => deps.handleDownloadPptxExportJobAction(env, actor, body),
    'record-telemetry': (_env, actor, body) => deps.handleRecordTelemetryAction(actor, body),
    'record-import-session-trace': (env, actor, body) => deps.handleRecordImportSessionTraceAction(env, actor, body),
    'record-export': (env, actor, body) => deps.handleRecordExportAction(env, actor, body),
  };
}
