import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAudioHash, getGlobalAudioCache, upsertGlobalAudioCache } from '@/utils/audioCache';
import { buildAudioScript } from '@/utils/audioScriptEngine';

type WeeklyPodcastPayload = {
  userId: string;
  weekStartDate?: string;
  weekEndDate?: string;
  deliveryKey?: string;
};

type BriefTheme = {
  title: string;
  consensus: string;
  sourceCount: number;
};

function createPodcastScript(overview: string, themes: BriefTheme[]) {
  const sectionBlocks = themes
    .slice(0, 4)
    .map(
      (theme, idx) =>
        `Topic ${idx + 1}: ${theme.title}. ${theme.consensus} This appeared across about ${theme.sourceCount} sources.`,
    );

  const built = buildAudioScript({
    title: 'Readflow weekly signal podcast',
    rawText: `${overview} ${sectionBlocks.join(' ')}`,
    sections: [
      overview,
      ...sectionBlocks,
      'Action plan: start with highlighted high-signal pieces, then decide which trends deserve deeper reads.',
    ],
  });

  return built.script;
}

async function upsertStatus(
  supabase: SupabaseClient,
  payload: WeeklyPodcastPayload,
  patch: Record<string, unknown>,
) {
  await supabase.from('weekly_podcast_cache').upsert(
    {
      user_id: payload.userId,
      delivery_key: payload.deliveryKey || null,
      week_start: payload.weekStartDate || null,
      week_end: payload.weekEndDate || null,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: 'user_id,delivery_key' },
  );
}

export async function processWeeklyPodcastJob(supabase: SupabaseClient, payload: WeeklyPodcastPayload) {
  if (!payload.userId) throw new Error('Missing userId payload');

  const briefQuery = supabase
    .from('weekly_briefs')
    .select('overview, themes, week_start, week_end, delivery_key')
    .eq('user_id', payload.userId)
    .order('created_at', { ascending: false });

  const { data: brief } = await (payload.deliveryKey
    ? briefQuery.eq('delivery_key', payload.deliveryKey).maybeSingle()
    : briefQuery
        .eq('week_start', payload.weekStartDate || '')
        .eq('week_end', payload.weekEndDate || '')
        .maybeSingle());

  if (!brief) throw new Error('Weekly brief not found for podcast generation');

  await upsertStatus(supabase, payload, {
    status: 'processing',
    provider: 'openai',
    generation_started_at: new Date().toISOString(),
  });

  const themes = (Array.isArray(brief.themes) ? brief.themes : []) as BriefTheme[];
  const script = createPodcastScript(brief.overview || '', themes);

  const audioHash = buildAudioHash([
    'readflow-weekly-podcast',
    payload.userId,
    brief.delivery_key || payload.deliveryKey || '',
    brief.week_start,
    brief.week_end,
    brief.overview || '',
    JSON.stringify(themes),
  ]);

  const globalHit = await getGlobalAudioCache(supabase, audioHash, 'weekly_podcast');
  if (globalHit?.audio_base64) {
    await upsertStatus(supabase, payload, {
      status: 'ready',
      model: globalHit.model,
      script_text: globalHit.script_text || script,
      mime_type: globalHit.mime_type || 'audio/mpeg',
      audio_base64: globalHit.audio_base64,
      audio_hash: audioHash,
      generation_completed_at: new Date().toISOString(),
      last_error: null,
    });
    return;
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await upsertStatus(supabase, payload, { status: 'failed', last_error: 'OPENAI_API_KEY missing' });
    throw new Error('OPENAI_API_KEY missing');
  }

  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({ model, input: script, voice, response_format: 'mp3' }),
  });

  if (!res.ok) {
    await upsertStatus(supabase, payload, {
      status: 'failed',
      model,
      last_error: `Audio provider failed: ${res.status}`,
    });
    throw new Error(`Audio provider failed: ${res.status}`);
  }

  const audioBuffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');

  await upsertGlobalAudioCache(supabase, {
    audioHash,
    contentType: 'weekly_podcast',
    mimeType: 'audio/mpeg',
    audioBase64,
    scriptText: script,
    provider: 'openai',
    model,
  });

  await upsertStatus(supabase, payload, {
    status: 'ready',
    model,
    script_text: script,
    mime_type: 'audio/mpeg',
    audio_base64: audioBase64,
    audio_hash: audioHash,
    generation_completed_at: new Date().toISOString(),
    last_error: null,
  });
}
