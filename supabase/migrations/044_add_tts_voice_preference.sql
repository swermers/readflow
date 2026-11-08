-- Migration 044: per-user text-to-speech voice choice
-- Stores a voice key from utils/voices.ts (e.g. 'kokoro:af_heart').
-- NULL means "use the app default" (TTS_DEFAULT_VOICE env var, else Kokoro Heart).

ALTER TABLE public.profile_preferences
  ADD COLUMN IF NOT EXISTS tts_voice TEXT;
