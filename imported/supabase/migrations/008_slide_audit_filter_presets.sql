-- SLD-BE-430: saved audit filter presets for Activity workspace views.

CREATE TABLE IF NOT EXISTS public.slide_audit_filter_presets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 120),
  scope               TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'shared')),
  search              TEXT NOT NULL DEFAULT '',
  action_filter       TEXT NOT NULL DEFAULT 'all' CHECK (
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
      'approve-approval',
      'reject-approval',
      'export-html',
      'export-pdf',
      'export-pptx'
    )
  ),
  outcome_filter      TEXT NOT NULL DEFAULT 'all' CHECK (outcome_filter IN ('all', 'success', 'failure')),
  entity_type_filter  TEXT NOT NULL DEFAULT 'all' CHECK (entity_type_filter IN ('all', 'slide', 'template')),
  date_from           DATE,
  date_to             DATE,
  is_archived         BOOLEAN NOT NULL DEFAULT false,
  created_by          TEXT NOT NULL DEFAULT '',
  updated_by          TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slide_audit_filter_presets_date_bounds
    CHECK (date_from IS NULL OR date_to IS NULL OR date_from <= date_to)
);

CREATE UNIQUE INDEX IF NOT EXISTS slide_audit_filter_presets_owner_scope_name_unique_idx
  ON public.slide_audit_filter_presets (owner_user_id, scope, lower(name))
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS slide_audit_filter_presets_scope_updated_idx
  ON public.slide_audit_filter_presets (scope, updated_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS slide_audit_filter_presets_owner_updated_idx
  ON public.slide_audit_filter_presets (owner_user_id, updated_at DESC)
  WHERE is_archived = false;

DROP TRIGGER IF EXISTS slide_audit_filter_presets_updated_at ON public.slide_audit_filter_presets;
CREATE TRIGGER slide_audit_filter_presets_updated_at
  BEFORE UPDATE ON public.slide_audit_filter_presets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.slide_audit_filter_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_audit_filter_presets;
CREATE POLICY "deny client access" ON public.slide_audit_filter_presets
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
      'export-pdf',
      'export-pptx'
    )
  );
