ALTER TABLE public.highlights
ADD COLUMN IF NOT EXISTS auto_tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_highlights_user_auto_tags ON public.highlights USING GIN (auto_tags);
