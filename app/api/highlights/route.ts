import { createClient } from '@/utils/supabase/server';
import { deriveAutoTags } from '@/utils/noteTags';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('selection_start') ||
    message.includes('selection_end') ||
    message.includes('ebook_id') ||
    message.includes('page_number')
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issue_id');
  const ebookId = searchParams.get('ebook_id');
  const search = searchParams.get('search')?.trim();
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

  const runListQuery = async (includeExtendedColumns: boolean) => {
    const baseFields = 'id, issue_id, highlighted_text, note, auto_tags, created_at';
    const selectionFields = includeExtendedColumns ? ', selection_start, selection_end' : '';
    const ebookFields = includeExtendedColumns ? ', ebook_id, page_number' : '';
    const issueJoin = ', issues(subject, sender_id, senders(name, email))';
    const ebookJoin = includeExtendedColumns ? ', ebooks(title, author)' : '';

    let query = supabase
      .from('highlights')
      .select(`${baseFields}${selectionFields}${ebookFields}${issueJoin}${ebookJoin}`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: sort === 'oldest' });

    if (issueId) {
      query = query.eq('issue_id', issueId);
    }

    if (ebookId) {
      query = query.eq('ebook_id', ebookId);
    }

    if (search) {
      const sanitized = search.replace(/[,%().*\\]/g, '');
      if (sanitized) {
        query = query.or(`highlighted_text.ilike.%${sanitized}%,note.ilike.%${sanitized}%`);
      }
    }

    return query;
  };

  let { data, error } = await runListQuery(true);

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await runListQuery(false));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 30 highlight creations per minute per user
  const rl = checkRateLimit(`highlights:${user.id}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const body = await request.json();
  const issueId = body.issue_id as string | undefined;
  const ebookId = body.ebook_id as string | undefined;
  const highlightedText = body.highlighted_text as string | undefined;
  const note = body.note as string | undefined;
  const selectionStart = body.selection_start as number | undefined;
  const selectionEnd = body.selection_end as number | undefined;
  const pageNumber = body.page_number as number | undefined;

  if (!highlightedText?.trim()) {
    return NextResponse.json({ error: 'highlighted_text is required' }, { status: 400 });
  }

  if (!issueId && !ebookId) {
    return NextResponse.json({ error: 'issue_id or ebook_id is required' }, { status: 400 });
  }

  const hasSelectionOffsets = typeof selectionStart === 'number' && typeof selectionEnd === 'number';
  if (hasSelectionOffsets && (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) || selectionStart < 0 || selectionEnd <= selectionStart)) {
    return NextResponse.json({ error: 'selection_start and selection_end must be valid increasing integers' }, { status: 400 });
  }

  const basePayload = {
    user_id: user.id,
    issue_id: issueId || null,
    highlighted_text: highlightedText.trim(),
    note: note?.trim() || null,
    auto_tags: deriveAutoTags(highlightedText.trim(), note),
  };

  const extendedPayload = {
    ...basePayload,
    ebook_id: ebookId || null,
    page_number: pageNumber ?? null,
    selection_start: hasSelectionOffsets ? selectionStart : null,
    selection_end: hasSelectionOffsets ? selectionEnd : null,
  };

  let { data, error } = await supabase
    .from('highlights')
    .insert(extendedPayload)
    .select('id, issue_id, ebook_id, highlighted_text, note, selection_start, selection_end, page_number, auto_tags, created_at')
    .single();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('highlights')
      .insert(basePayload)
      .select('id, issue_id, highlighted_text, note, auto_tags, created_at')
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
