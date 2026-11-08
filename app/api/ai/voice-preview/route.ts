export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';
import { synthesizeSpeech } from '@/utils/openrouter';
import { isValidVoiceKey, resolveVoice } from '@/utils/voices';

const SAMPLE_TEXT =
  "Here's your ReadFlow briefing. This is how your newsletters will sound when you press listen.";

/**
 * POST /api/ai/voice-preview  { voice: "<voice key>" }
 * Returns a short MP3 sample so people can hear a voice before choosing it.
 * The sample is under 100 characters, so it costs a fraction of a cent.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`voice-preview:${user.id}`, 6, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const body = await request.json().catch(() => ({}));
  const key = (body as { voice?: unknown }).voice;
  if (!isValidVoiceKey(key)) {
    return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
  }

  const voice = resolveVoice(key);
  const result = await synthesizeSpeech(voice.model, voice.voice, SAMPLE_TEXT);
  if (!result.ok) {
    console.error('Voice preview failed:', voice.key, result.status, result.reason);
    return NextResponse.json(
      { error: `This voice is unavailable right now (${result.status || 'network error'}).` },
      { status: 502 },
    );
  }

  return new NextResponse(Buffer.from(result.audioBuffer), {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' },
  });
}
