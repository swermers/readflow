import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ebooks — Upload a new ebook (manual upload from browser)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || '';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  const ext = file.name.split('.').pop()?.toLowerCase();
  const fileType = ext === 'epub' ? 'epub' : ext === 'pdf' ? 'pdf' : null;

  if (!fileType) {
    return NextResponse.json({ error: 'Only PDF and EPUB files are supported' }, { status: 400 });
  }

  // 20 MB limit
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
  }

  const ebookTitle = title.trim() || file.name.replace(/\.(pdf|epub)$/i, '').replace(/[-_]/g, ' ').trim() || 'Untitled';

  // Create record
  const { data: ebook, error: insertError } = await supabase
    .from('ebooks')
    .insert({
      user_id: user.id,
      title: ebookTitle,
      file_path: '',
      file_name: file.name,
      file_size: file.size,
      file_type: fileType,
      status: 'unread',
    })
    .select()
    .single();

  if (insertError || !ebook) {
    return NextResponse.json({ error: 'Failed to create ebook record' }, { status: 500 });
  }

  // Upload to storage
  const storagePath = `${user.id}/${ebook.id}.${fileType}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('ebooks')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || (fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
      upsert: false,
    });

  if (uploadError) {
    // Clean up record
    await supabase.from('ebooks').delete().eq('id', ebook.id);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }

  // Update with storage path
  const { data: updated, error: updateError } = await supabase
    .from('ebooks')
    .update({ file_path: storagePath })
    .eq('id', ebook.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update ebook record' }, { status: 500 });
  }

  return NextResponse.json(updated);
}
