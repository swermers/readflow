-- Migration 042: Move audio from base64 text columns to Supabase Storage
-- ──────────────────────────────────────────────────────────────────────────
-- The audio_global_cache, issue_audio_cache, and weekly_podcast_cache tables
-- store full audio as base64-encoded text directly in Postgres. Base64 adds
-- ~33% overhead, bloats tables, and prevents streaming.
--
-- This migration:
--   1. Creates an "audio" storage bucket
--   2. Adds *_storage_path columns alongside the existing base64 columns
--   3. Leaves the base64 columns in place for backward compatibility during
--      the rollout window — a future migration can drop them once all code
--      reads from storage paths.

-- ─── 1. Create the audio storage bucket ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  false,
  52428800,  -- 50 MB max
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: service role can read/write, authenticated users can read own files
-- The path convention is: {user_id}/{type}/{hash_or_id}.mp3

-- Allow service role full access (used by background jobs)
CREATE POLICY "Service role full access to audio bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'audio')
  WITH CHECK (bucket_id = 'audio');

-- Allow authenticated users to read their own audio files
CREATE POLICY "Users can read own audio files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2. Add storage path columns to audio tables ─────────────────────────

-- audio_global_cache: shared cross-user cache
ALTER TABLE public.audio_global_cache
  ADD COLUMN IF NOT EXISTS audio_storage_path text;

-- issue_audio_cache: per-user article audio
ALTER TABLE public.issue_audio_cache
  ADD COLUMN IF NOT EXISTS audio_storage_path text,
  ADD COLUMN IF NOT EXISTS first_chunk_storage_path text;

-- weekly_podcast_cache: per-user weekly podcast audio
ALTER TABLE public.weekly_podcast_cache
  ADD COLUMN IF NOT EXISTS audio_storage_path text,
  ADD COLUMN IF NOT EXISTS first_chunk_storage_path text;
