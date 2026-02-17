-- Track deleted Gmail-backed issues so sync does not re-import them

CREATE TABLE IF NOT EXISTS public.deleted_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_issues_user_message_id
  ON public.deleted_issues(user_id, message_id);

CREATE INDEX IF NOT EXISTS idx_deleted_issues_user_id
  ON public.deleted_issues(user_id);

ALTER TABLE public.deleted_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can read own deleted issues"
  ON public.deleted_issues FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can insert own deleted issues"
  ON public.deleted_issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can delete own deleted issues"
  ON public.deleted_issues FOR DELETE
  USING (auth.uid() = user_id);
