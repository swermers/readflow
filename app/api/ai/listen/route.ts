export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { consumeCreditsAtomic, ensureCreditsAvailable } from '@/utils/aiEntitlements';

const MAX_INPUT_CHARS = 3500;
const STALE_PROCESSING_MS = 2 * 60 * 1000;

type AudioStatus = 'missing' | 'queued' | 'processing' | 'failed' | 'ready' | 'canceled';

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeForSpeech(text: string) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, '$1')
    .replace(/\bhttps?:\/\/[^\s]+/gi, '[link]')
    .replace(/\bwww\.[^\s]+/gi, '[link]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\s+\[[^\]]*link[^\]]*\]\s*/gi, ' [link] ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtSignoff(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 8) return text;

  const signoffPatterns = [
    /^(best|best regards|regards|kind regards|warm regards|warmly|cheers|thanks|thank you)[,!\-\s]*$/i,
    /^(with love|much love|big love|love)[,!\-\s]*$/i,
    /^(see you|see you next week|until next time)[.!\-\s]*$/i,
  ];

  const minIndex = Math.floor(lines.length * 0.6);
  for (let i = minIndex; i < lines.length; i += 1) {
    if (signoffPatterns.some((pattern) => pattern.test(lines[i]))) {
      return lines.slice(0, i).join('\n').trim();
    }
  }

  return text;
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
    .select('audio_base64, mime_type, status, updated_at, credits_charged, credits_charged_at')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  return cachedAudio;
}

function shouldStartProcessing(status: string | null | undefined, updatedAt: string | null | undefined) {
  if (status === 'queued') return true;
  if (status !== 'processing' || !updatedAt) return false;

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return Number.isFinite(ageMs) && ageMs > STALE_PROCESSING_MS;
}

async function generateAudioInBackground(
  issueId: string,
  userId: string,
  issue: Awaited<ReturnType<typeof getUserIssue>>,
) {
  if (!issue) return;

  const supabase = await createClient();

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status: 'processing',
      provider: 'openai',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' }
  );

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'failed',
        provider: 'openai',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' }
    );
    return;
  }

  const articleText = (issue.body_text?.trim() || stripHtml(issue.body_html || '')).trim();
  const contentWithoutSignoff = truncateAtSignoff(articleText);
  const speechText = sanitizeForSpeech(contentWithoutSignoff || articleText);
  const input = `${issue.subject || 'Newsletter article'}\n\n${speechText.slice(0, MAX_INPUT_CHARS)}`;
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'failed',
        provider: 'openai',
        model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' }
    );
    return;
  }

  const latest = await getCachedAudio(supabase, issueId, userId);
  if (latest?.status === 'canceled') return;

  const audioBuffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');

  let chargedCredits = Number(latest?.credits_charged || 0);
  let chargedAt = latest?.credits_charged_at || null;

  if (!chargedAt || chargedCredits < 2) {
    const consumeResult = await consumeCreditsAtomic(supabase, userId, 2);
    if (!consumeResult.allowed) {
      await supabase.from('issue_audio_cache').upsert(
        {
          issue_id: issueId,
          user_id: userId,
          status: 'failed',
          provider: 'openai',
          model,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'issue_id,user_id' }
      );
      return;
    }

    chargedCredits = 2;
    chargedAt = new Date().toISOString();
  }

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status: 'ready',
      mime_type: 'audio/mpeg',
      audio_base64: audioBase64,
      provider: 'openai',
      model,
      credits_charged: chargedCredits,
      credits_charged_at: chargedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' }
  );
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

  if (shouldStartProcessing(cachedAudio?.status, cachedAudio?.updated_at)) {
    void generateAudioInBackground(issueId, user.id, issue);
  }

  return NextResponse.json(
    {
      status: (isReady ? 'ready' : cachedAudio?.status || 'missing') as AudioStatus,
      audioAvailable: isReady,
      audioUrl: isReady ? `/api/ai/listen/audio?issueId=${encodeURIComponent(issueId)}` : null,
      updatedAt: cachedAudio?.updated_at || null,
    },
    { status: 200 }
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
      { status: 200 }
    );
  }

  const creditGate = await ensureCreditsAvailable(supabase, user.id, 2);
  if (!creditGate.allowed) {
    return NextResponse.json(
      {
        error: creditGate.reason || 'Monthly AI credit limit reached',
        planTier: creditGate.tier,
        creditsRemaining: creditGate.remaining,
        creditsLimit: creditGate.limit,
        resetsAt: creditGate.resetAt,
      },
      { status: 402 }
    );
  }

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: user.id,
      status: 'queued',
      provider: 'openai',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' }
  );

  void generateAudioInBackground(issueId, user.id, issue);

  return NextResponse.json(
    {
      status: 'queued' as AudioStatus,
      audioUrl: null,
      planTier: creditGate.tier,
      creditsRemaining: creditGate.remaining,
      creditsLimit: creditGate.limit,
    },
    { status: 202 }
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
    { onConflict: 'issue_id,user_id' }
  );

  return NextResponse.json({ status: 'canceled' as AudioStatus }, { status: 200 });
}
