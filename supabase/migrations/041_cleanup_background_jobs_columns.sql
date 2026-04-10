-- Migration 041: Clean up redundant columns on background_jobs
-- ──────────────────────────────────────────────────────────────
-- Three successive queue migrations (020, 022×2, 023) introduced
-- duplicate columns for the same concepts. The active app code
-- (utils/jobs.ts, admin replay route) uses a consistent set:
--
--   Locking:    locked_by, locked_at, lease_expires_at
--   Scheduling: retry_at
--   Errors:     last_error, dead_lettered_at, dead_letter_reason
--
-- The following columns are unused duplicates or dead fields:
--   • worker_id        — duplicate of locked_by
--   • leased_at        — duplicate of locked_at
--   • lock_expires_at  — duplicate of lease_expires_at
--   • available_at     — duplicate of retry_at
--   • next_attempt_at  — duplicate of retry_at
--   • failed_at        — unused (last_error + status suffice)
--   • last_error_at    — unused (last_error + updated_at suffice)
--   • started_at       — unused
--   • last_duration_ms — unused

-- Drop unused indexes that reference dead columns
DROP INDEX IF EXISTS idx_background_jobs_claim_v2;       -- references next_attempt_at
DROP INDEX IF EXISTS idx_background_jobs_dead_v2;         -- references dead_lettered_at DESC (still exists, but recreated below)

-- Drop redundant columns
ALTER TABLE public.background_jobs
  DROP COLUMN IF EXISTS worker_id,
  DROP COLUMN IF EXISTS leased_at,
  DROP COLUMN IF EXISTS lock_expires_at,
  DROP COLUMN IF EXISTS available_at,
  DROP COLUMN IF EXISTS next_attempt_at,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS last_error_at,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS last_duration_ms;

-- Ensure the kept columns exist (idempotent)
ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter_reason text,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS queue_latency_ms integer;

-- Recreate clean indexes
DROP INDEX IF EXISTS idx_background_jobs_claim;
CREATE INDEX idx_background_jobs_claim
  ON public.background_jobs (type, status, retry_at, created_at)
  WHERE status IN ('queued', 'failed');

DROP INDEX IF EXISTS idx_background_jobs_dead_letter;
CREATE INDEX idx_background_jobs_dead_letter
  ON public.background_jobs (type, status, dead_lettered_at DESC)
  WHERE status = 'dead_letter';

DROP INDEX IF EXISTS idx_background_jobs_lease;
CREATE INDEX idx_background_jobs_lease
  ON public.background_jobs (status, lease_expires_at)
  WHERE status = 'processing';

-- ─── Rebuild enqueue_background_job() ─────────────────────────────────────
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
    type, dedupe_key, payload, status, attempts, max_attempts,
    retry_at, last_error, dead_letter_reason, dead_lettered_at,
    completed_at, locked_by, locked_at, lease_expires_at, updated_at
  )
  VALUES (
    p_type, p_dedupe_key, COALESCE(p_payload, '{}'::jsonb),
    'queued', 0, GREATEST(COALESCE(p_max_attempts, 5), 1),
    now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, now()
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE SET
    payload = EXCLUDED.payload,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = now(),
    status = CASE
      WHEN background_jobs.status IN ('completed', 'dead_letter') THEN background_jobs.status
      ELSE 'queued'
    END,
    retry_at = CASE
      WHEN background_jobs.status IN ('completed', 'dead_letter') THEN now()
      ELSE background_jobs.retry_at
    END,
    attempts = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN 0
      ELSE background_jobs.attempts
    END,
    last_error = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.last_error
    END,
    dead_letter_reason = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.dead_letter_reason
    END,
    dead_lettered_at = CASE
      WHEN background_jobs.status IN ('failed', 'dead_letter') THEN NULL
      ELSE background_jobs.dead_lettered_at
    END
  RETURNING id INTO job_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) TO authenticated, service_role;

-- ─── Rebuild claim_background_jobs() ──────────────────────────────────────
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
  -- Reclaim expired leases
  UPDATE public.background_jobs
  SET
    status = 'queued',
    locked_by = NULL,
    locked_at = NULL,
    lease_expires_at = NULL,
    retry_at = now(),
    updated_at = now()
  WHERE type = p_type
    AND status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= now();

  -- Claim available jobs
  RETURN QUERY
  WITH candidates AS (
    SELECT bj.id
    FROM public.background_jobs bj
    WHERE bj.type = p_type
      AND (
        (bj.status IN ('queued', 'failed') AND COALESCE(bj.retry_at, bj.created_at) <= now())
        OR (bj.status = 'processing' AND COALESCE(bj.lease_expires_at, bj.locked_at, bj.updated_at) <= now())
      )
      AND bj.dead_lettered_at IS NULL
      AND bj.attempts < bj.max_attempts
    ORDER BY bj.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  )
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
    queue_latency_ms = (EXTRACT(EPOCH FROM (now() - bj.created_at)) * 1000)::integer,
    updated_at = now()
  WHERE bj.id IN (SELECT id FROM candidates)
  RETURNING bj.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_background_jobs(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, text, integer, integer) TO authenticated, service_role;

-- ─── Rebuild audio pregeneration trigger ──────────────────────────────────
-- The trigger from migration 039 references retry_at, which we keep.
-- Just update it to not reference any dropped columns.
CREATE OR REPLACE FUNCTION enqueue_audio_pregenerate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO background_jobs (type, payload, dedupe_key, status, max_attempts, retry_at, updated_at)
  VALUES (
    'audio.pregenerate',
    jsonb_build_object('userId', NEW.user_id, 'issueId', NEW.id),
    'pregen:' || NEW.user_id || ':' || NEW.id,
    'queued',
    3,
    now(),
    now()
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;
