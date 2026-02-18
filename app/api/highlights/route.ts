import { createClient } from '@/utils/supabase/server';
import { deriveAutoTags } from '@/utils/noteTags';
import { NextRequest, NextResponse } from 'next/server';

function isMissingSelectionColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('selection_start') ||
    message.includes('selection_end')
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
  const search = searchParams.get('search')?.trim();
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

  const runListQuery = async (includeSelectionOffsets: boolean) => {
    let query = supabase
      .from('highlights')
      .select(
        includeSelectionOffsets
          ? 'id, issue_id, highlighted_text, note, selection_start, selection_end, auto_tags, created_at, issues(subject, sender_id, senders(name, email))'
          : 'id, issue_id, highlighted_text, note, auto_tags, created_at, issues(subject, sender_id, senders(name, email))'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: sort === 'oldest' });

    if (issueId) {
      query = query.eq('issue_id', issueId);
    }

    if (search) {
      query = query.or(`highlighted_text.ilike.%${search}%,note.ilike.%${search}%`);
    }

    return query;
  };

  let { data, error } = await runListQuery(true);

  if (error && isMissingSelectionColumnError(error)) {
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

  const body = await request.json();
  const issueId = body.issue_id as string | undefined;
  const highlightedText = body.highlighted_text as string | undefined;
  const note = body.note as string | undefined;
  const selectionStart = body.selection_start as number | undefined;
  const selectionEnd = body.selection_end as number | undefined;

  if (!issueId || !highlightedText?.trim()) {
    return NextResponse.json({ error: 'issue_id and highlighted_text are required' }, { status: 400 });
  }

  const hasSelectionOffsets = typeof selectionStart === 'number' && typeof selectionEnd === 'number';
  if (hasSelectionOffsets && (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) || selectionStart < 0 || selectionEnd <= selectionStart)) {
    return NextResponse.json({ error: 'selection_start and selection_end must be valid increasing integers' }, { status: 400 });
  }

  const basePayload = {
    user_id: user.id,
    issue_id: issueId,
    highlighted_text: highlightedText.trim(),
    note: note?.trim() || null,
    auto_tags: deriveAutoTags(highlightedText.trim(), note),
  };

  let { data, error } = await supabase
    .from('highlights')
    .insert({
      ...basePayload,
      selection_start: hasSelectionOffsets ? selectionStart : null,
      selection_end: hasSelectionOffsets ? selectionEnd : null,
    })
    .select('id, issue_id, highlighted_text, note, selection_start, selection_end, auto_tags, created_at')
    .single();

  if (error && isMissingSelectionColumnError(error)) {
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
