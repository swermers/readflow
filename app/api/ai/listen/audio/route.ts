export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const { data: cachedAudio } = await supabase
    .from('issue_audio_cache')
    .select('audio_base64, mime_type')
    .eq('issue_id', issueId)
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .maybeSingle();

  if (!cachedAudio?.audio_base64) {
    return NextResponse.json({ error: 'Audio not ready yet' }, { status: 404 });
  }

  return new NextResponse(Buffer.from(cachedAudio.audio_base64, 'base64'), {
    status: 200,
    headers: {
      'content-type': cachedAudio.mime_type || 'audio/mpeg',
      'cache-control': 'no-store',
    },
  });
}
