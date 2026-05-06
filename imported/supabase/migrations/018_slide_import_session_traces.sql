-- SLD-BE-460: import observability trace ledger for FE/BE correlation evidence.

CREATE TABLE IF NOT EXISTS public.slide_import_session_traces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id    TEXT NOT NULL CHECK (char_length(correlation_id) > 0 AND char_length(correlation_id) <= 120),
  actor_user_id     TEXT NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  actor_email       TEXT,
  phase             TEXT NOT NULL CHECK (phase IN ('parse-start', 'parse-end', 'parse-error', 'parse-canceled', 'parse-fallback')),
  source            TEXT NOT NULL DEFAULT 'unknown',
  taxonomy_buckets  JSONB NOT NULL DEFAULT '{}'::jsonb,
  counters          JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms       INTEGER,
  error_code        TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slide_import_session_traces_actor_created_idx
  ON public.slide_import_session_traces (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_import_session_traces_correlation_created_idx
  ON public.slide_import_session_traces (correlation_id, created_at DESC);

ALTER TABLE public.slide_import_session_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.slide_import_session_traces;
CREATE POLICY "deny client access" ON public.slide_import_session_traces
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
