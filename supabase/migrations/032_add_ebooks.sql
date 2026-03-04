-- ═══════════════════════════════════════════════════════
-- EBOOKS: "Send to ReadFlow" for PDFs and EPUBs
-- ═══════════════════════════════════════════════════════

-- Ebooks table
CREATE TABLE IF NOT EXISTS ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'pdf' CHECK (file_type IN ('pdf', 'epub')),
  sender_email TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished')),
  current_page INT DEFAULT 0,
  total_pages INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ebooks"
  ON ebooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ebooks"
  ON ebooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ebooks"
  ON ebooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ebooks"
  ON ebooks FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_ebooks_user_id ON ebooks(user_id);
CREATE INDEX idx_ebooks_user_status ON ebooks(user_id, status);

-- Storage bucket for ebook files
INSERT INTO storage.buckets (id, name, public)
VALUES ('ebooks', 'ebooks', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can manage files in their own folder
CREATE POLICY "Users upload own ebooks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ebooks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own ebooks"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ebooks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own ebooks"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ebooks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role bypass for edge function uploads
CREATE POLICY "Service role manages ebooks storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'ebooks' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'ebooks' AND auth.role() = 'service_role');
