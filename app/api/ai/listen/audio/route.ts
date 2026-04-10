export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { downloadAudio } from '@/utils/audioStorage';
import { NextRequest, NextResponse } from 'next/server';

function buildAudioHeaders(mimeType: string, byteLength: number) {
  return {
    'content-type': mimeType,
    'cache-control': 'no-store',
    'accept-ranges': 'bytes',
    'content-length': String(byteLength),
  };
}

async function getAudio(issueId: string, userId: string, preview: boolean) {
  const supabase = await createClient();
  const { data: cachedAudio } = await supabase
    .from('issue_audio_cache')
    .select('audio_base64, audio_storage_path, first_chunk_base64, first_chunk_storage_path, mime_type, status')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!cachedAudio) return null;

  if (preview) {
    // Prefer storage, fall back to inline base64
    let base64 = cachedAudio.first_chunk_base64;
    if (cachedAudio.first_chunk_storage_path && !base64) {
      const buf = await downloadAudio(supabase, cachedAudio.first_chunk_storage_path);
      if (buf) base64 = buf.toString('base64');
    }
    return { audioBase64: base64, mimeType: cachedAudio.mime_type };
  }

  if (cachedAudio.status !== 'ready' && cachedAudio.status !== 'pregenerated') return null;

  // Prefer storage, fall back to inline base64
  let base64 = cachedAudio.audio_base64;
  if (cachedAudio.audio_storage_path && !base64) {
    const buf = await downloadAudio(supabase, cachedAudio.audio_storage_path);
    if (buf) base64 = buf.toString('base64');
  }

  return { audioBase64: base64, mimeType: cachedAudio.mime_type };
}

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

  const preview = request.nextUrl.searchParams.get('preview') === '1';
  const cachedAudio = await getAudio(issueId, user.id, preview);

  if (!cachedAudio?.audioBase64) {
    return NextResponse.json({ error: preview ? 'Preview audio not ready yet' : 'Audio not ready yet' }, { status: 404 });
  }

  const audioBuffer = Buffer.from(cachedAudio.audioBase64, 'base64');
  const mimeType = cachedAudio.mimeType || 'audio/mpeg';
  const totalLength = audioBuffer.byteLength;
  const rangeHeader = request.headers.get('range');

  if (!rangeHeader || preview) {
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: buildAudioHeaders(mimeType, totalLength),
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'content-range': `bytes */${totalLength}`,
        'accept-ranges': 'bytes',
      },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const requestedEnd = match[2] ? Number(match[2]) : totalLength - 1;

  if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0 || start >= totalLength || requestedEnd < start) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'content-range': `bytes */${totalLength}`,
        'accept-ranges': 'bytes',
      },
    });
  }

  const end = Math.min(requestedEnd, totalLength - 1);
  const chunk = audioBuffer.subarray(start, end + 1);

  return new NextResponse(chunk, {
    status: 206,
    headers: {
      'content-type': mimeType,
      'cache-control': 'no-store',
      'accept-ranges': 'bytes',
      'content-length': String(chunk.byteLength),
      'content-range': `bytes ${start}-${end}/${totalLength}`,
    },
  });
}

export async function HEAD(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse(null, { status: 401 });

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) return new NextResponse(null, { status: 400 });

  const preview = request.nextUrl.searchParams.get('preview') === '1';
  const cachedAudio = await getAudio(issueId, user.id, preview);
  if (!cachedAudio?.audioBase64) return new NextResponse(null, { status: 404 });

  const audioBuffer = Buffer.from(cachedAudio.audioBase64, 'base64');
  return new NextResponse(null, {
    status: 200,
    headers: buildAudioHeaders(cachedAudio.mimeType || 'audio/mpeg', audioBuffer.byteLength),
  });
}
