-- Slides platform foundation: slide records, template library, and audit events.
-- App auth is handled through Azure/MSAL + Cloudflare Access, so browser clients
-- do not directly access these tables. Service-role API functions handle access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.slide_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     TEXT REFERENCES public.app_users(user_id) ON DELETE SET NULL,
  name              TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 160),
  description       TEXT NOT NULL DEFAULT '',
  is_shared         BOOLEAN NOT NULL DEFAULT false,
  canvas            JSONB NOT NULL DEFAULT '{"width":1920,"height":1080}'::jsonb,
  components_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  created_by        TEXT NOT NULL DEFAULT '',
  updated_by        TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.slides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 160),
  canvas            JSONB NOT NULL DEFAULT '{"width":1920,"height":1080}'::jsonb,
  components_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision          INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('import', 'template', 'manual')),
  source_template_id UUID REFERENCES public.slide_templates(id) ON DELETE SET NULL,
  created_by        TEXT NOT NULL DEFAULT '',
  updated_by        TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_edited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.slide_audit_events (
  id                BIGSERIAL PRIMARY KEY,
  actor_user_id     TEXT NOT NULL,
  actor_email       TEXT,
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('slide', 'template')),
  entity_id         TEXT NOT NULL,
  action            TEXT NOT NULL CHECK (action IN ('save', 'autosave', 'delete', 'duplicate', 'rename', 'publish-template', 'export-html', 'export-pdf')),
  outcome           TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  error_class       TEXT,
  details           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slides_owner_updated_idx
  ON public.slides (owner_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS slides_template_idx
  ON public.slides (source_template_id)
  WHERE source_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS slide_templates_shared_updated_idx
  ON public.slide_templates (is_shared, updated_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS slide_templates_owner_updated_idx
  ON public.slide_templates (owner_user_id, updated_at DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS slide_audit_actor_created_idx
  ON public.slide_audit_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_audit_entity_created_idx
  ON public.slide_audit_events (entity_type, entity_id, created_at DESC);

DROP TRIGGER IF EXISTS slide_templates_updated_at ON public.slide_templates;
CREATE TRIGGER slide_templates_updated_at
  BEFORE UPDATE ON public.slide_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS slides_updated_at ON public.slides;
CREATE TRIGGER slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.slide_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_templates;
CREATE POLICY "deny client access" ON public.slide_templates
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny client access" ON public.slides;
CREATE POLICY "deny client access" ON public.slides
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny client access" ON public.slide_audit_events;
CREATE POLICY "deny client access" ON public.slide_audit_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
