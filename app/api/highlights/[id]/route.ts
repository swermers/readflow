import { createClient } from '@/utils/supabase/server';
import { deriveAutoTags } from '@/utils/noteTags';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const note = body.note as string | undefined;

  const { data: existing, error: existingError } = await supabase
    .from('highlights')
    .select('highlighted_text')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message || 'Highlight not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('highlights')
    .update({ note: note?.trim() || null, auto_tags: deriveAutoTags(existing.highlighted_text, note) })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, issue_id, highlighted_text, note, auto_tags, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
