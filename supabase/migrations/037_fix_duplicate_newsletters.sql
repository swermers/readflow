-- ═══════════════════════════════════════════════════════
-- FIX DUPLICATE NEWSLETTERS
-- ═══════════════════════════════════════════════════════
-- Problem: Same newsletter can be inserted twice due to:
-- 1. Race conditions in check-then-insert pattern
-- 2. Empty-string message_ids bypassing the unique index
-- 3. Different message_id formats between email forwarding and Gmail sync
--
-- Solution: Add a content_hash column for cross-path deduplication
-- and a unique index on (user_id, content_hash) to prevent duplicates
-- at the database level regardless of the ingestion path.

-- Add a content hash column for reliable cross-path dedup
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Populate content_hash for existing rows (subject + from_email + date part of received_at)
UPDATE public.issues
  SET content_hash = encode(
    sha256(
      convert_to(
        COALESCE(subject, '') || '|' || COALESCE(from_email, '') || '|' || COALESCE(DATE(received_at)::text, ''),
        'UTF8'
      )
    ),
    'hex'
  )
  WHERE content_hash IS NULL;

-- Unique index on content_hash — prevents the same content from being
-- inserted twice regardless of which path (email forward vs Gmail sync)
-- NULL content_hash values are excluded so old/broken rows don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_user_content_hash
  ON public.issues(user_id, content_hash)
  WHERE content_hash IS NOT NULL;

-- Also fix the existing message_id index to exclude empty strings
DROP INDEX IF EXISTS idx_issues_user_message_id;
CREATE UNIQUE INDEX idx_issues_user_message_id
  ON public.issues(user_id, message_id)
  WHERE message_id IS NOT NULL AND message_id != '';
