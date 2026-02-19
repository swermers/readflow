ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter_reason text,
  ADD COLUMN IF NOT EXISTS queue_latency_ms integer,
  ADD COLUMN IF NOT EXISTS last_duration_ms integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'background_jobs_status_check'
      AND conrelid = 'public.background_jobs'::regclass
  ) THEN
    ALTER TABLE public.background_jobs DROP CONSTRAINT background_jobs_status_check;
  END IF;
END $$;

ALTER TABLE public.background_jobs
  ADD CONSTRAINT background_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter'));

CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON public.background_jobs (type, status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_background_jobs_dead_letter
  ON public.background_jobs (status, failed_at DESC)
  WHERE status IN ('failed', 'dead_letter');

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
    available_at,
    last_error,
    dead_letter_reason,
    failed_at,
    completed_at,
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
    now()
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE
  SET
    type = EXCLUDED.type,
    payload = EXCLUDED.payload,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = now(),
    status = CASE
      WHEN background_jobs.status IN ('queued', 'processing', 'completed') THEN background_jobs.status
      ELSE 'queued'
    END,
    attempts = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN 0
      ELSE background_jobs.attempts
    END,
    available_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN now()
      ELSE background_jobs.available_at
    END,
    last_error = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.last_error
    END,
    last_error_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.last_error_at
    END,
    dead_letter_reason = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.dead_letter_reason
    END,
    failed_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.failed_at
    END,
    locked_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.locked_at
    END,
    lock_expires_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.lock_expires_at
    END,
    locked_by = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.locked_by
    END
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_background_jobs(
  p_type text,
  p_limit integer DEFAULT 25,
  p_worker_id text DEFAULT NULL,
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
    updated_at = now(),
    locked_at = NULL,
    lock_expires_at = NULL,
    locked_by = NULL,
    available_at = now()
  WHERE type = p_type
    AND status = 'processing'
    AND lock_expires_at IS NOT NULL
    AND lock_expires_at <= now();

  RETURN QUERY
  WITH to_claim AS (
    SELECT id
    FROM public.background_jobs
    WHERE type = p_type
      AND status = 'queued'
      AND available_at <= now()
    ORDER BY created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.background_jobs j
  SET
    status = 'processing',
    locked_at = now(),
    lock_expires_at = now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 180), 30)),
    locked_by = COALESCE(p_worker_id, 'worker'),
    started_at = now(),
    queue_latency_ms = (EXTRACT(EPOCH FROM (now() - j.created_at)) * 1000)::integer,
    updated_at = now()
  FROM to_claim
  WHERE j.id = to_claim.id
  RETURNING j.*;
END;
$$;
