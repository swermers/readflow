-- Migration: Add audio pre-generation at ingest time
-- When a new issue is inserted, automatically enqueue an audio.pregenerate job
-- so digest text + TTS audio are ready before the user clicks play.

-- Add 'pregenerated' as a recognized status for issue_audio_cache.
-- Audio with this status is fully generated but credits haven't been charged yet.
-- When the user clicks play, credits are charged and status flips to 'ready'.

-- Trigger function: enqueue an audio.pregenerate background job on issue insert
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

-- Attach trigger to issues table (fires after each new issue is inserted)
DROP TRIGGER IF EXISTS trg_audio_pregenerate ON issues;
CREATE TRIGGER trg_audio_pregenerate
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_audio_pregenerate();
