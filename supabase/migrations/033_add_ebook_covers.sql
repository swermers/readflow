-- Add cover_url column to ebooks table
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS cover_url TEXT;
