ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS signal_tier text NOT NULL DEFAULT 'unclassified'
  CHECK (signal_tier IN ('high_signal', 'news', 'reference', 'unclassified')),
ADD COLUMN IF NOT EXISTS signal_reason text;

CREATE INDEX IF NOT EXISTS idx_issues_user_signal_tier
  ON public.issues(user_id, signal_tier);
