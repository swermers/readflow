-- ═══════════════════════════════════════════════════════
-- EBOOK HIGHLIGHTS: Allow highlights to be linked to ebooks
-- ═══════════════════════════════════════════════════════

-- Make issue_id nullable so highlights can belong to an ebook instead
ALTER TABLE public.highlights
  ALTER COLUMN issue_id DROP NOT NULL;

-- Add ebook_id column
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS ebook_id UUID REFERENCES public.ebooks(id) ON DELETE CASCADE;

-- Add page_number to track which PDF page the highlight came from
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS page_number INT;

-- Index for querying highlights by ebook
CREATE INDEX IF NOT EXISTS idx_highlights_ebook_id ON public.highlights(ebook_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_ebook ON public.highlights(user_id, ebook_id);

-- Ensure every highlight belongs to either an issue or an ebook
ALTER TABLE public.highlights
  ADD CONSTRAINT highlights_issue_or_ebook
  CHECK (issue_id IS NOT NULL OR ebook_id IS NOT NULL);
