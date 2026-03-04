import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ebooks/[id]/cover — Upload a cover image for an ebook
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the ebook belongs to the user
  const { data: ebook, error: fetchError } = await supabase
    .from('ebooks')
    .select('id, cover_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !ebook) {
    return NextResponse.json({ error: 'Ebook not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('cover') as File | null;

  if (!file || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'No valid image provided' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const storagePath = `${user.id}/${ebook.id}_cover.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  // Delete old cover if it exists
  if (ebook.cover_url) {
    // Extract old path from signed URL is tricky — just try to remove common extensions
    const oldExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const oldPaths = oldExts.map((e) => `${user.id}/${ebook.id}_cover.${e}`);
    await supabase.storage.from('ebooks').remove(oldPaths);
  }

  const { error: uploadError } = await supabase.storage
    .from('ebooks')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload cover image' }, { status: 500 });
  }

  // Get a public/signed URL for the cover
  const { data: urlData } = await supabase.storage
    .from('ebooks')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

  const coverUrl = urlData?.signedUrl || '';

  // Save cover_url to the ebook record
  const { error: updateError } = await supabase
    .from('ebooks')
    .update({ cover_url: coverUrl })
    .eq('id', ebook.id)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save cover URL' }, { status: 500 });
  }

  return NextResponse.json({ cover_url: coverUrl });
}
