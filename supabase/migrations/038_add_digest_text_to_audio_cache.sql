-- Cache the AI-generated digest script text so re-generating audio
-- (e.g. after cancellation) doesn't require another AI summarization call.

ALTER TABLE public.issue_audio_cache
  ADD COLUMN IF NOT EXISTS digest_text text;
