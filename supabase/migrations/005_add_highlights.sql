-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  highlighted_text TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_issue_id ON public.highlights(issue_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_issue ON public.highlights(user_id, issue_id);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own highlights" ON public.highlights;
CREATE POLICY "Users can read own highlights"
  ON public.highlights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own highlights" ON public.highlights;
CREATE POLICY "Users can insert own highlights"
  ON public.highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own highlights" ON public.highlights;
CREATE POLICY "Users can update own highlights"
  ON public.highlights FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own highlights" ON public.highlights;
CREATE POLICY "Users can delete own highlights"
  ON public.highlights FOR DELETE
  USING (auth.uid() = user_id);
