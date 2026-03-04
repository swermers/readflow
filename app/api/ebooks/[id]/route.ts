import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/ebooks/[id] — Update ebook status or reading progress
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.status) {
    const validStatuses = ['unread', 'reading', 'finished'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updateData.status = body.status;
  }

  if (typeof body.current_page === 'number') {
    updateData.current_page = body.current_page;
  }

  if (typeof body.total_pages === 'number') {
    updateData.total_pages = body.total_pages;
  }

  if (body.title) {
    updateData.title = body.title;
  }

  if (body.author !== undefined) {
    updateData.author = body.author;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ebooks')
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

// DELETE /api/ebooks/[id] — Delete an ebook and its file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the ebook to get the file path
  const { data: ebook, error: fetchError } = await supabase
    .from('ebooks')
    .select('id, file_path')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !ebook) {
    return NextResponse.json({ error: 'Ebook not found' }, { status: 404 });
  }

  // Delete file from storage
  if (ebook.file_path) {
    await supabase.storage.from('ebooks').remove([ebook.file_path]);
  }

  // Delete record
  const { error } = await supabase
    .from('ebooks')
    .delete()
    .eq('id', ebook.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
