import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/highlights?issue_id=xxx  — highlights for a specific issue
// GET /api/highlights               — all highlights (for Notes page)
// GET /api/highlights?search=term   — search across text and notes
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const issueId = searchParams.get('issue_id');
  const search = searchParams.get('search');

  if (issueId) {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // All highlights with issue + sender info (for Notes page)
  let query = supabase
    .from('highlights')
    .select('*, issues!inner(id, subject, sender_id, senders!inner(id, name))')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(
      `highlighted_text.ilike.%${search}%,note.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/highlights — create a new highlight
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { issue_id, highlighted_text, note } = body;

  if (!issue_id || !highlighted_text) {
    return NextResponse.json(
      { error: 'issue_id and highlighted_text are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: user.id,
      issue_id,
      highlighted_text: highlighted_text.trim(),
      note: note?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
