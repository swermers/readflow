-- Cache AI-generated summaries to avoid re-summarizing the same issue.
-- Saves API costs and improves response times for repeat views.

CREATE TABLE IF NOT EXISTS public.issue_summaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text NOT NULL,
  takeaways jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(issue_id)
);

ALTER TABLE public.issue_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own summaries"
  ON public.issue_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries"
  ON public.issue_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries"
  ON public.issue_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_issue_summaries_issue_id ON public.issue_summaries(issue_id);
CREATE INDEX idx_issue_summaries_user_id ON public.issue_summaries(user_id);
