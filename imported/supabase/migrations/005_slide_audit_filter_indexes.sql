-- SLD-BE-420: Support operational audit filtering with indexed query paths.

CREATE INDEX IF NOT EXISTS slide_audit_action_created_idx
  ON public.slide_audit_events (action, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_audit_outcome_created_idx
  ON public.slide_audit_events (outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS slide_audit_created_idx
  ON public.slide_audit_events (created_at DESC);
