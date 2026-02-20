ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notion_access_token_enc text,
  ADD COLUMN IF NOT EXISTS notion_workspace_id text,
  ADD COLUMN IF NOT EXISTS notion_workspace_name text,
  ADD COLUMN IF NOT EXISTS notion_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'idle'
    CHECK (notion_sync_status IN ('idle', 'queued', 'syncing', 'ok', 'error')),
  ADD COLUMN IF NOT EXISTS notion_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_last_error text;

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_source_hash text,
  ADD COLUMN IF NOT EXISTS notion_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (notion_sync_status IN ('pending', 'synced', 'error'));

CREATE INDEX IF NOT EXISTS idx_highlights_user_notion_sync
  ON public.highlights (user_id, notion_sync_status, created_at DESC);

ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'background_jobs_status_check'
  ) THEN
    ALTER TABLE public.background_jobs
      ADD CONSTRAINT background_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter'));
  ELSE
    ALTER TABLE public.background_jobs
      DROP CONSTRAINT background_jobs_status_check;

    ALTER TABLE public.background_jobs
      ADD CONSTRAINT background_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON public.background_jobs (type, status, retry_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_background_jobs_lease
  ON public.background_jobs (status, lease_expires_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.enqueue_background_job(
  p_type text,
  p_dedupe_key text,
  p_payload jsonb,
  p_max_attempts integer DEFAULT 5
)
RETURNS TABLE (job_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.background_jobs (
    type,
    dedupe_key,
    payload,
    status,
    attempts,
    max_attempts,
    retry_at,
    dead_lettered_at,
    last_error,
    completed_at,
    locked_by,
    locked_at,
    lease_expires_at,
    updated_at
  )
  VALUES (
    p_type,
    p_dedupe_key,
    COALESCE(p_payload, '{}'::jsonb),
    'queued',
    0,
    GREATEST(COALESCE(p_max_attempts, 5), 1),
    now(),
    null,
    null,
    null,
    null,
    null,
    null,
    now()
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE SET
    payload = EXCLUDED.payload,
    max_attempts = EXCLUDED.max_attempts,
    status = CASE
      WHEN background_jobs.status IN ('completed', 'dead_letter') THEN background_jobs.status
      ELSE 'queued'
    END,
    retry_at = now(),
    updated_at = now()
  RETURNING id INTO job_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_background_jobs(
  p_type text,
  p_worker_id text,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 240
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT bj.id
    FROM public.background_jobs bj
    WHERE bj.type = p_type
      AND (
        (bj.status IN ('queued', 'failed') AND COALESCE(bj.retry_at, bj.created_at) <= now())
        OR (bj.status = 'processing' AND COALESCE(bj.lease_expires_at, bj.locked_at, bj.updated_at) <= now())
      )
      AND (bj.dead_lettered_at IS NULL)
      AND bj.attempts < bj.max_attempts
    ORDER BY bj.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.background_jobs bj
    SET
      status = 'processing',
      attempts = CASE
        WHEN bj.status = 'processing' THEN bj.attempts
        ELSE bj.attempts + 1
      END,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 240), 30)),
      updated_at = now()
    WHERE bj.id IN (SELECT id FROM candidates)
    RETURNING bj.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_background_jobs(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, text, integer, integer) TO authenticated, service_role;
