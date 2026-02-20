export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const STREAM_TIMEOUT_MS = 25_000;
const POLL_MS = 1200;

async function loadAudioState(issueId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('issue_audio_cache')
    .select('status, updated_at, audio_base64, first_chunk_base64')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const isReady = data.status === 'ready' && Boolean(data.audio_base64);
  const hasPreview = ['queued', 'processing'].includes(data.status || '') && Boolean(data.first_chunk_base64);

  return {
    status: data.status || 'missing',
    updatedAt: data.updated_at || null,
    audioAvailable: isReady,
    audioUrl: isReady ? `/api/ai/listen/audio?issueId=${encodeURIComponent(issueId)}` : null,
    previewAudioUrl: hasPreview ? `/api/ai/listen/audio?issueId=${encodeURIComponent(issueId)}&preview=1` : null,
  };
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

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send('connected', { issueId });

      while (Date.now() - startedAt < STREAM_TIMEOUT_MS) {
        const state = await loadAudioState(issueId, user.id);
        send('status', state || { status: 'missing', audioAvailable: false, audioUrl: null, previewAudioUrl: null });

        if (!state || state.status === 'ready' || state.status === 'failed' || state.status === 'canceled') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      send('done', { issueId });
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
