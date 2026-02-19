ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notion_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS notion_workspace_id text,
  ADD COLUMN IF NOT EXISTS notion_workspace_name text,
  ADD COLUMN IF NOT EXISTS notion_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS notion_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_last_error text;

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notion_source_hash text;

CREATE INDEX IF NOT EXISTS idx_profiles_notion_sync_status
  ON public.profiles(notion_sync_status, notion_last_sync_at);

CREATE INDEX IF NOT EXISTS idx_highlights_notion_sync_lookup
  ON public.highlights(user_id, notion_sync_status, notion_last_synced_at);

CREATE INDEX IF NOT EXISTS idx_highlights_notion_page
  ON public.highlights(notion_page_id)
  WHERE notion_page_id IS NOT NULL;

ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS leased_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_latency_ms integer;

CREATE INDEX IF NOT EXISTS idx_background_jobs_claim_v2
  ON public.background_jobs(type, status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_background_jobs_dead_v2
  ON public.background_jobs(type, status, dead_lettered_at DESC)
  WHERE status = 'dead_letter';

CREATE OR REPLACE FUNCTION public.enqueue_background_job(
  p_type text,
  p_payload jsonb,
  p_dedupe_key text,
  p_max_attempts integer DEFAULT 5
)
RETURNS public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job public.background_jobs;
BEGIN
  INSERT INTO public.background_jobs (
    type,
    payload,
    dedupe_key,
    status,
    attempts,
    max_attempts,
    next_attempt_at,
    worker_id,
    leased_at,
    lease_expires_at,
    completed_at,
    dead_letter_reason,
    dead_lettered_at,
    updated_at
  )
  VALUES (
    p_type,
    COALESCE(p_payload, '{}'::jsonb),
    p_dedupe_key,
    'queued',
    0,
    GREATEST(COALESCE(p_max_attempts, 5), 1),
    now(),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE
  SET
    payload = EXCLUDED.payload,
    type = EXCLUDED.type,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = now(),
    status = CASE
      WHEN background_jobs.status IN ('processing', 'queued') THEN background_jobs.status
      ELSE 'queued'
    END,
    next_attempt_at = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN now()
      ELSE background_jobs.next_attempt_at
    END,
    attempts = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN 0
      ELSE background_jobs.attempts
    END,
    completed_at = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN NULL
      ELSE background_jobs.completed_at
    END,
    last_error = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN NULL
      ELSE background_jobs.last_error
    END,
    last_error_at = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN NULL
      ELSE background_jobs.last_error_at
    END,
    dead_letter_reason = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN NULL
      ELSE background_jobs.dead_letter_reason
    END,
    dead_lettered_at = CASE
      WHEN background_jobs.status IN ('completed', 'failed', 'dead_letter') THEN NULL
      ELSE background_jobs.dead_lettered_at
    END
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_background_jobs(
  p_type text,
  p_worker_id text,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.background_jobs
  SET
    status = 'queued',
    worker_id = NULL,
    leased_at = NULL,
    lease_expires_at = NULL,
    updated_at = now()
  WHERE type = p_type
    AND status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= now();

  RETURN QUERY
  WITH claimable AS (
    SELECT j.id
    FROM public.background_jobs j
    WHERE j.type = p_type
      AND j.status = 'queued'
      AND j.next_attempt_at <= now()
    ORDER BY j.created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.background_jobs j
  SET
    status = 'processing',
    worker_id = p_worker_id,
    leased_at = now(),
    lease_expires_at = now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 180), 30)),
    attempts = COALESCE(j.attempts, 0) + 1,
    queue_latency_ms = (EXTRACT(EPOCH FROM (now() - j.created_at)) * 1000)::integer,
    updated_at = now()
  FROM claimable
  WHERE j.id = claimable.id
  RETURNING j.*;
END;
$$;
