import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/issues/[id] — Update issue status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  const validStatuses = ['unread', 'read', 'archived'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be: unread, read, or archived' },
      { status: 400 }
    );
  }

  const updateData: any = { status };

  if (status === 'read') {
    updateData.read_at = new Date().toISOString();
    updateData.archived_at = null;
  } else if (status === 'archived') {
    updateData.archived_at = new Date().toISOString();
    updateData.read_at = new Date().toISOString();
  } else if (status === 'unread') {
    updateData.read_at = null;
    updateData.archived_at = null;
  }

  const { data, error } = await supabase
    .from('issues')
    .update(updateData)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/issues/[id] — Permanently delete one issue
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: highlightsDeleteError } = await supabase
    .from('highlights')
    .delete()
    .eq('issue_id', params.id);

  if (highlightsDeleteError) {
    return NextResponse.json({ error: highlightsDeleteError.message }, { status: 500 });
  }

  const { data: deletedIssue, error } = await supabase
    .from('issues')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!deletedIssue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: deletedIssue.id });
}
