ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS selection_start integer,
  ADD COLUMN IF NOT EXISTS selection_end integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'highlights_selection_offsets_valid'
  ) THEN
    ALTER TABLE public.highlights
      ADD CONSTRAINT highlights_selection_offsets_valid
      CHECK (
        (selection_start IS NULL AND selection_end IS NULL)
        OR (selection_start IS NOT NULL AND selection_end IS NOT NULL AND selection_start >= 0 AND selection_end > selection_start)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_highlights_issue_selection
  ON public.highlights(issue_id, selection_start);
