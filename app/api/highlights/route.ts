import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

  let query = supabase
    .from('highlights')
    .select('id, issue_id, highlighted_text, note, created_at, issues(subject, sender_id, senders(name, email))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: sort === 'oldest' });

  if (issueId) {
    query = query.eq('issue_id', issueId);
  }

  if (search) {
    query = query.or(`highlighted_text.ilike.%${search}%,note.ilike.%${search}%`);
  }

  const { data, error } = await query;

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

  if (!issueId || !highlightedText?.trim()) {
    return NextResponse.json({ error: 'issue_id and highlighted_text are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: user.id,
      issue_id: issueId,
      highlighted_text: highlightedText.trim(),
      note: note?.trim() || null,
    })
    .select('id, issue_id, highlighted_text, note, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
