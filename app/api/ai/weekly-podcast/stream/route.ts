export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const STREAM_TIMEOUT_MS = 25_000;
const POLL_MS = 1200;

async function loadPodcastState(
  userId: string,
  params: { deliveryKey?: string | null; weekStart?: string | null; weekEnd?: string | null },
) {
  const supabase = await createClient();

  let query = supabase
    .from('weekly_podcast_cache')
    .select('status, updated_at, audio_base64, first_chunk_base64, delivery_key, week_start, week_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (params.deliveryKey) {
    query = query.eq('delivery_key', params.deliveryKey);
  } else if (params.weekStart && params.weekEnd) {
    query = query.eq('week_start', params.weekStart).eq('week_end', params.weekEnd);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const hasReady = data.status === 'ready' && Boolean(data.audio_base64);
  const hasPreview = ['queued', 'processing'].includes(data.status || '') && Boolean(data.first_chunk_base64);
  const keyPart = data.delivery_key
    ? `deliveryKey=${encodeURIComponent(data.delivery_key)}`
    : `weekStart=${encodeURIComponent(data.week_start || '')}&weekEnd=${encodeURIComponent(data.week_end || '')}`;

  return {
    status: data.status || 'missing',
    updatedAt: data.updated_at || null,
    audioAvailable: hasReady,
    audioUrl: hasReady ? `/api/ai/weekly-podcast/audio?${keyPart}` : null,
    previewAudioUrl: hasPreview ? `/api/ai/weekly-podcast/audio?preview=1&${keyPart}` : null,
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

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send('connected', { deliveryKey, weekStart, weekEnd });

      while (Date.now() - startedAt < STREAM_TIMEOUT_MS) {
        const state = await loadPodcastState(user.id, { deliveryKey, weekStart, weekEnd });
        send('status', state || { status: 'missing', audioAvailable: false, audioUrl: null, previewAudioUrl: null });

        if (!state || state.status === 'ready' || state.status === 'failed') break;

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      send('done', { deliveryKey, weekStart, weekEnd });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
