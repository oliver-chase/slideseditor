-- SLD-BE-440: approval escalation audit support and preset filtering.

ALTER TABLE public.slide_audit_events
  DROP CONSTRAINT IF EXISTS slide_audit_events_action_check;

ALTER TABLE public.slide_audit_events
  ADD CONSTRAINT slide_audit_events_action_check
  CHECK (
    action IN (
      'save',
      'autosave',
      'delete',
      'duplicate',
      'rename',
      'publish-template',
      'transfer-template',
      'upsert-collaborator',
      'remove-collaborator',
      'submit-approval',
      'escalate-approval',
      'approve-approval',
      'reject-approval',
      'export-html',
      'export-pdf',
      'export-pptx'
    )
  );

ALTER TABLE public.slide_audit_filter_presets
  DROP CONSTRAINT IF EXISTS slide_audit_filter_presets_action_filter_check;

ALTER TABLE public.slide_audit_filter_presets
  ADD CONSTRAINT slide_audit_filter_presets_action_filter_check
  CHECK (
    action_filter IN (
      'all',
      'save',
      'autosave',
      'delete',
      'duplicate',
      'rename',
      'publish-template',
      'transfer-template',
      'upsert-collaborator',
      'remove-collaborator',
      'submit-approval',
      'escalate-approval',
      'approve-approval',
      'reject-approval',
      'export-html',
      'export-pdf',
      'export-pptx'
    )
  );
