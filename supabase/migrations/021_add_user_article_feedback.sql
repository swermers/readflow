CREATE TABLE IF NOT EXISTS public.user_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  sender_email text,
  feedback_type text NOT NULL CHECK (feedback_type IN ('not_relevant')),
  auto_tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_article_feedback_user_created_at
  ON public.user_article_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_article_feedback_user_sender
  ON public.user_article_feedback (user_id, sender_email);

CREATE INDEX IF NOT EXISTS idx_user_article_feedback_auto_tags
  ON public.user_article_feedback USING GIN (auto_tags);

ALTER TABLE public.user_article_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own article feedback" ON public.user_article_feedback;
CREATE POLICY "Users can insert own article feedback"
  ON public.user_article_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own article feedback" ON public.user_article_feedback;
CREATE POLICY "Users can read own article feedback"
  ON public.user_article_feedback
  FOR SELECT
  USING (auth.uid() = user_id);
