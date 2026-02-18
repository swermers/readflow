-- Add soft-delete support for issues so deleted cards stay hidden and cannot be re-imported.
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_issues_user_deleted_at
  ON public.issues(user_id, deleted_at);
