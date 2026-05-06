-- SLD-BE-430: long-range audit export jobs for compliance workflows.

CREATE TABLE IF NOT EXISTS public.slide_audit_export_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id  TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  requested_by_email    TEXT,
  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  filters               JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count             INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  file_name             TEXT,
  csv_content           TEXT,
  error_message         TEXT,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_by            TEXT NOT NULL DEFAULT '',
  updated_by            TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slide_audit_export_jobs_requested_idx
  ON public.slide_audit_export_jobs (requested_by_user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS slide_audit_export_jobs_status_idx
  ON public.slide_audit_export_jobs (status, requested_at DESC);

DROP TRIGGER IF EXISTS slide_audit_export_jobs_updated_at ON public.slide_audit_export_jobs;
CREATE TRIGGER slide_audit_export_jobs_updated_at
  BEFORE UPDATE ON public.slide_audit_export_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.slide_audit_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_audit_export_jobs;
CREATE POLICY "deny client access" ON public.slide_audit_export_jobs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
