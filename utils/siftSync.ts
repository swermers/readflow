import { createAdminClient } from '@/utils/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const SIFT_USER_ID = '524f98f2-c7ec-49d3-87ad-6a1e13ac1b95';

async function resolveArticleTitle(
  supabase: SupabaseClient,
  issueId: string | null,
  ebookId: string | null,
): Promise<string | null> {
  if (issueId) {
    const { data } = await supabase
      .from('issues')
      .select('subject')
      .eq('id', issueId)
      .single();
    return data?.subject ?? null;
  }
  if (ebookId) {
    const { data } = await supabase
      .from('ebooks')
      .select('title')
      .eq('id', ebookId)
      .single();
    return data?.title ?? null;
  }
  return null;
}

export function syncHighlightToSift(
  readflowSupabase: SupabaseClient,
  highlight: {
    highlighted_text: string;
    note: string | null;
    issue_id: string | null;
    ebook_id: string | null;
  },
): void {
  resolveArticleTitle(readflowSupabase, highlight.issue_id, highlight.ebook_id)
    .then((articleTitle) => {
      const admin = createAdminClient();
      return admin.from('rf_highlights').insert({
        user_id: SIFT_USER_ID,
        article_id: highlight.issue_id ?? highlight.ebook_id ?? null,
        highlight_text: highlight.highlighted_text,
        note: highlight.note,
        article_url: null,
        article_title: articleTitle,
      });
    })
    .then(() => {})
    .catch((err) => {
      console.error('[sift] highlight sync failed:', err);
    });
}
