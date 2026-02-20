export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkEntitlement, format402Payload } from '@/utils/aiEntitlements';
import { enqueueJob } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';

const STALE_PROCESSING_MS = 5 * 60 * 1000;

type AudioStatus = 'missing' | 'queued' | 'processing' | 'failed' | 'ready' | 'canceled';

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function getUserIssue(supabase: Awaited<ReturnType<typeof createClient>>, issueId: string, userId: string) {
  const { data: issue, error } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html')
    .eq('id', issueId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !issue) return null;
  return issue;
}

async function getCachedAudio(supabase: Awaited<ReturnType<typeof createClient>>, issueId: string, userId: string) {
  const { data: cachedAudio } = await supabase
    .from('issue_audio_cache')
    .select('audio_base64, mime_type, status, updated_at')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  return cachedAudio;
}

function shouldRequeue(status: string | null | undefined, updatedAt: string | null | undefined) {
  if (status === 'queued') return false;
  if (status !== 'processing' || !updatedAt) return false;

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return Number.isFinite(ageMs) && ageMs > STALE_PROCESSING_MS;
}

async function enqueueAudioJob(userId: string, issueId: string) {
  const admin = createAdminClient();
  await enqueueJob(admin, 'audio.requested', { userId, issueId }, `audio:${userId}:${issueId}`, { maxAttempts: 5 });
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const issue = await getUserIssue(supabase, issueId, user.id);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const cachedAudio = await getCachedAudio(supabase, issueId, user.id);
  const isReady = Boolean(cachedAudio?.audio_base64 && cachedAudio?.status === 'ready');

  if (shouldRequeue(cachedAudio?.status, cachedAudio?.updated_at)) {
    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: user.id,
        status: 'queued',
        provider: 'openai',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' },
    );
    await enqueueAudioJob(user.id, issueId);
  }

  return NextResponse.json(
    {
      status: (isReady ? 'ready' : cachedAudio?.status || 'missing') as AudioStatus,
      audioAvailable: isReady,
      audioUrl: isReady ? `/api/ai/listen/audio?issueId=${encodeURIComponent(issueId)}` : null,
      updatedAt: cachedAudio?.updated_at || null,
    },
    { status: 200 },
  );
}

export async function HEAD(request: NextRequest) {
  const { supabase, user } = await requireUser();

  if (!user) return new NextResponse(null, { status: 401 });

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) return new NextResponse(null, { status: 400 });

  const cachedAudio = await getCachedAudio(supabase, issueId, user.id);
  if (!cachedAudio?.audio_base64 || cachedAudio.status !== 'ready') {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'content-type': cachedAudio.mime_type || 'audio/mpeg',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const issueId = body?.issueId as string | undefined;

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const issue = await getUserIssue(supabase, issueId, user.id);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const articleText = (issue.body_text?.trim() || stripHtml(issue.body_html || '')).trim();
  if (!articleText) {
    return NextResponse.json({ error: 'No article text available for audio narration' }, { status: 400 });
  }

  const cachedAudio = await getCachedAudio(supabase, issueId, user.id);

  if (cachedAudio?.audio_base64 && cachedAudio.status === 'ready') {
    return NextResponse.json(
      {
        status: 'ready' as AudioStatus,
        audioUrl: `/api/ai/listen/audio?issueId=${encodeURIComponent(issueId)}`,
      },
      { status: 200 },
    );
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'listen');
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
  }

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: user.id,
      status: 'processing',
      provider: 'openai',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );

  await enqueueAudioJob(user.id, issueId);

  return NextResponse.json(
    {
      status: 'queued' as AudioStatus,
      audioUrl: null,
      planTier: entitlement.tier,
      tokensRemaining: entitlement.available,
      tokensLimit: entitlement.limit,
      unlimitedAiAccess: entitlement.unlimitedAiAccess || false,
    },
    { status: 202 },
  );
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const cachedAudio = await getCachedAudio(supabase, issueId, user.id);
  if (!cachedAudio || !['queued', 'processing'].includes(cachedAudio.status || '')) {
    return NextResponse.json({ status: (cachedAudio?.status || 'missing') as AudioStatus }, { status: 200 });
  }

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: user.id,
      status: 'canceled',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );

  return NextResponse.json({ status: 'canceled' as AudioStatus }, { status: 200 });
}
