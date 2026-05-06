-- SLD-BE-410: collaborator governance and audit action expansion.

CREATE TABLE IF NOT EXISTS public.slide_template_collaborators (
  template_id      UUID NOT NULL REFERENCES public.slide_templates(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('editor', 'reviewer', 'viewer')),
  created_by       TEXT NOT NULL DEFAULT '',
  updated_by       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);

CREATE INDEX IF NOT EXISTS slide_template_collaborators_template_role_idx
  ON public.slide_template_collaborators (template_id, role, updated_at DESC);

CREATE INDEX IF NOT EXISTS slide_template_collaborators_user_template_idx
  ON public.slide_template_collaborators (user_id, template_id);

DROP TRIGGER IF EXISTS slide_template_collaborators_updated_at ON public.slide_template_collaborators;
CREATE TRIGGER slide_template_collaborators_updated_at
  BEFORE UPDATE ON public.slide_template_collaborators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.slide_template_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_template_collaborators;
CREATE POLICY "deny client access" ON public.slide_template_collaborators
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

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
      'export-html',
      'export-pdf'
    )
  );
