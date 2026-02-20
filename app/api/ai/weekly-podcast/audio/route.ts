export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function buildAudioHeaders(mimeType: string, byteLength: number) {
  return {
    'content-type': mimeType,
    'cache-control': 'no-store',
    'accept-ranges': 'bytes',
    'content-length': String(byteLength),
  };
}

async function getPodcastAudio(
  userId: string,
  opts: { deliveryKey?: string | null; weekStart?: string | null; weekEnd?: string | null; preview?: boolean },
) {
  const supabase = await createClient();

  let query = supabase
    .from('weekly_podcast_cache')
    .select('status, mime_type, audio_base64, first_chunk_base64')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (opts.deliveryKey) {
    query = query.eq('delivery_key', opts.deliveryKey);
  } else if (opts.weekStart && opts.weekEnd) {
    query = query.eq('week_start', opts.weekStart).eq('week_end', opts.weekEnd);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  if (opts.preview) {
    return {
      audioBase64: data.first_chunk_base64,
      mimeType: data.mime_type,
    };
  }

  if (data.status !== 'ready') return null;

  return {
    audioBase64: data.audio_base64,
    mimeType: data.mime_type,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deliveryKey = request.nextUrl.searchParams.get('deliveryKey');
  const weekStart = request.nextUrl.searchParams.get('weekStart');
  const weekEnd = request.nextUrl.searchParams.get('weekEnd');
  const preview = request.nextUrl.searchParams.get('preview') === '1';

  const cachedAudio = await getPodcastAudio(user.id, { deliveryKey, weekStart, weekEnd, preview });
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
