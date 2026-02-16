-- Highlights & Notes for newsletter content
-- Run after 004_auto_approve_senders.sql

CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  highlighted_text TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_issue_id ON highlights(issue_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_issue ON highlights(user_id, issue_id);

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own highlights"
  ON highlights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON highlights FOR DELETE
  USING (auth.uid() = user_id);
