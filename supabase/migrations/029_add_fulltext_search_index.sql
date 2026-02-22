-- Full-text search index on issues for semantic search feature
-- Uses PostgreSQL tsvector with english dictionary for stemming

-- Add a generated tsvector column for fast search
ALTER TABLE issues ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(snippet, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_issues_search_vector ON issues USING gin(search_vector);

-- Also add trigram index for fuzzy/partial matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_issues_subject_trgm ON issues USING gin(subject gin_trgm_ops);

-- RPC function for full-text search with ranking
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
BEGIN
  -- Convert the query to a tsquery with prefix matching for partial words
  tsquery_val := websearch_to_tsquery('english', p_query);

  RETURN QUERY
  SELECT
    i.id,
    i.subject,
    i.snippet,
    i.from_email,
    i.received_at,
    i.status,
    s.name AS sender_name,
    ts_rank(i.search_vector, tsquery_val) AS rank
  FROM issues i
  LEFT JOIN senders s ON s.id = i.sender_id
  WHERE i.user_id = p_user_id
    AND i.deleted_at IS NULL
    AND i.search_vector @@ tsquery_val
  ORDER BY rank DESC, i.received_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
