export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_INPUT_CHARS = 5000;

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
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

  const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!xaiApiKey) {
    return NextResponse.json({ error: 'XAI_API_KEY (or GROK_API_KEY) is not configured' }, { status: 500 });
  }

  const input = `${issue.subject || 'Newsletter article'}\n\n${articleText.slice(0, MAX_INPUT_CHARS)}`;
  const model = process.env.XAI_VOICE_MODEL || 'grok-2-tts-latest';
  const voice = process.env.XAI_VOICE_NAME || 'alloy';

  const res = await fetch('https://api.x.ai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${xaiApiKey}`,
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
    return NextResponse.json(
      {
        error: `xAI audio request failed: ${res.status} ${details}`,
        hints: [
          'Verify XAI_API_KEY is set for this environment and redeploy',
          'Check that XAI_VOICE_MODEL is available on your xAI account',
          'Try changing XAI_VOICE_NAME if your selected voice is unsupported',
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
