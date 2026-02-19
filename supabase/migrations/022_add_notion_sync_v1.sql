ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notion_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notion_workspace_id text,
  ADD COLUMN IF NOT EXISTS notion_workspace_name text,
  ADD COLUMN IF NOT EXISTS notion_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'idle' CHECK (notion_sync_status IN ('idle', 'queued', 'syncing', 'failed')),
  ADD COLUMN IF NOT EXISTS notion_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_last_sync_error text;

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending' CHECK (notion_sync_status IN ('pending', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS notion_source_hash text;

CREATE INDEX IF NOT EXISTS idx_highlights_notion_sync
  ON public.highlights(user_id, notion_sync_status, notion_last_synced_at);
