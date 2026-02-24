-- Add sender email to the full-text search index
-- This allows users to search by sender email directly

-- Drop and recreate the search_vector column to include from_email
ALTER TABLE issues DROP COLUMN IF EXISTS search_vector;

ALTER TABLE issues ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(from_email, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(snippet, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) STORED;

-- Recreate GIN index
DROP INDEX IF EXISTS idx_issues_search_vector;
CREATE INDEX idx_issues_search_vector ON issues USING gin(search_vector);

-- Update the search RPC to also match by sender name (ilike fallback)
CREATE OR REPLACE FUNCTION search_issues(
  p_user_id uuid,
  p_query text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  subject text,
  snippet text,
  from_email text,
  received_at timestamptz,
  status text,
  sender_name text,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsquery_val tsquery;
  safe_query text;
BEGIN
  tsquery_val := websearch_to_tsquery('english', p_query);
  safe_query := '%' || lower(p_query) || '%';

  RETURN QUERY
  SELECT
    final.id, final.subject, final.snippet, final.from_email,
    final.received_at, final.status, final.sender_name, final.rank
  FROM (
    SELECT DISTINCT ON (combined.id)
      combined.id, combined.subject, combined.snippet, combined.from_email,
      combined.received_at, combined.status, combined.sender_name, combined.rank
    FROM (
      -- Full-text search on issue content + from_email
      SELECT
        i.id, i.subject, i.snippet, i.from_email,
        i.received_at, i.status,
        s.name AS sender_name,
        ts_rank(i.search_vector, tsquery_val) AS rank
      FROM issues i
      LEFT JOIN senders s ON s.id = i.sender_id
      WHERE i.user_id = p_user_id
        AND i.deleted_at IS NULL
        AND i.search_vector @@ tsquery_val

      UNION ALL

      -- Sender name fuzzy match (catches searches by sender name)
      SELECT
        i.id, i.subject, i.snippet, i.from_email,
        i.received_at, i.status,
        s.name AS sender_name,
        0.5::real AS rank
      FROM issues i
      INNER JOIN senders s ON s.id = i.sender_id
      WHERE i.user_id = p_user_id
        AND i.deleted_at IS NULL
        AND lower(s.name) LIKE safe_query
    ) combined
    ORDER BY combined.id, combined.rank DESC
  ) final
  ORDER BY final.rank DESC, final.received_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
