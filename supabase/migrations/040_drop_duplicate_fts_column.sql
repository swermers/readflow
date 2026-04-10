-- Migration 040: Drop duplicate `fts` tsvector column on issues
-- ─────────────────────────────────────────────────────────────
-- The `issues` table has two tsvector columns:
--   • `fts`           — original, weights on subject/snippet/body_text
--   • `search_vector` — superset, also indexes from_email (migration 031)
--
-- No application code references `fts`; all search goes through
-- `search_vector` via the `search_issues()` RPC. Drop `fts` and its
-- GIN index to save storage and write amplification.

-- Drop the GIN index first (if it exists)
DROP INDEX IF EXISTS idx_issues_fts;

-- Drop the column
ALTER TABLE public.issues DROP COLUMN IF EXISTS fts;
