import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/ebooks/[id]/file — Serve the ebook file (authenticated)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the ebook record (RLS ensures ownership)
  const { data: ebook, error: fetchError } = await supabase
    .from('ebooks')
    .select('id, file_path, file_name, file_type')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !ebook) {
    return NextResponse.json({ error: 'Ebook not found' }, { status: 404 });
  }

  // Download from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('ebooks')
    .download(ebook.file_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const contentType = ebook.file_type === 'pdf' ? 'application/pdf' : 'application/epub+zip';

  return new NextResponse(fileData, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${ebook.file_name}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
