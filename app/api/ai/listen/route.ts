export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Keep narration concise enough for responsive generation latency.
const MAX_INPUT_CHARS = 3500;

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
    // Remove markdown links but keep human-readable label text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, '$1')
    // Replace raw URLs with a short token so TTS doesn't spell them out
    .replace(/\bhttps?:\/\/[^\s]+/gi, '[link]')
    .replace(/\bwww\.[^\s]+/gi, '[link]')
    // Emails can be similarly verbose when read aloud
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    // Remove leftover URL-ish punctuation noise
    .replace(/\s+\[[^\]]*link[^\]]*\]\s*/gi, ' [link] ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const issueId = body?.issueId as string | undefined;

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const { data: issue, error } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html')
    .eq('id', issueId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const articleText = (issue.body_text?.trim() || stripHtml(issue.body_html || '')).trim();
  if (!articleText) {
    return NextResponse.json({ error: 'No article text available for audio narration' }, { status: 400 });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
  }

  const speechText = sanitizeForSpeech(articleText);
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
    const details = await res.text();
    const parsedDetails = (() => {
      try {
        return JSON.parse(details) as {
          error?: string | { message?: string; code?: string; type?: string };
          code?: string;
          message?: string;
        };
      } catch {
        return null;
      }
    })();

    const nestedError = parsedDetails?.error;
    const statusMessage =
      (typeof nestedError === 'object' ? nestedError?.message : nestedError) || parsedDetails?.message || details;
    const isPermissionError = res.status === 401 || res.status === 403;

    return NextResponse.json(
      {
        error: `OpenAI audio request failed: ${res.status} ${statusMessage}`,
        hints: isPermissionError
          ? [
              'Verify OPENAI_API_KEY is valid for this deployment environment and redeploy',
              'Confirm your OpenAI project/billing is active and has access to the selected TTS model',
              'If this key was recently rotated, update the env var and trigger a fresh deploy',
            ]
          : [
              'Check that OPENAI_TTS_MODEL is available on your account',
              'Try changing OPENAI_TTS_VOICE if your selected voice is unsupported',
              'Optionally override OPENAI_AUDIO_ENDPOINT if routing through a gateway/proxy',
            ],
      },
      { status: 500 }
    );
  }

  const audioBuffer = await res.arrayBuffer();

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'no-store',
    },
  });
}
