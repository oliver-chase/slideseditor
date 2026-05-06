-- SLD-BE-410 follow-up: governance approval workflow for template delegation actions.

CREATE TABLE IF NOT EXISTS public.slide_template_approvals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES public.slide_templates(id) ON DELETE CASCADE,
  requested_by_user_id  TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  requested_by_email    TEXT,
  approval_type         TEXT NOT NULL CHECK (approval_type IN ('transfer-template', 'upsert-collaborator', 'remove-collaborator')),
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note           TEXT,
  reviewed_by_user_id   TEXT REFERENCES public.app_users(user_id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slide_template_approvals_status_created_idx
  ON public.slide_template_approvals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_template_approvals_template_created_idx
  ON public.slide_template_approvals (template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_template_approvals_requester_created_idx
  ON public.slide_template_approvals (requested_by_user_id, created_at DESC);

DROP TRIGGER IF EXISTS slide_template_approvals_updated_at ON public.slide_template_approvals;
CREATE TRIGGER slide_template_approvals_updated_at
  BEFORE UPDATE ON public.slide_template_approvals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.slide_template_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_template_approvals;
CREATE POLICY "deny client access" ON public.slide_template_approvals
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
      'submit-approval',
      'approve-approval',
      'reject-approval',
      'export-html',
      'export-pdf'
    )
  );
