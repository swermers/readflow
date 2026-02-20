import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAudioHash, getGlobalAudioCache, upsertGlobalAudioCache } from '@/utils/audioCache';
import { latencyMs, recordAudioMetric } from '@/utils/audioMetrics';
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

const MAX_CHUNK_CHARS = 2500;
const FIRST_CHUNK_CHARS = 420;

function splitIntoSpeechChunks(input: string) {
  if (input.length <= FIRST_CHUNK_CHARS) return [input];

  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return input.match(new RegExp(`.{1,${MAX_CHUNK_CHARS}}`, 'g')) || [input];
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const targetLimit = chunks.length === 0 ? FIRST_CHUNK_CHARS : MAX_CHUNK_CHARS;
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= targetLimit) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = sentence;
      continue;
    }

    const hardLimit = chunks.length === 0 ? FIRST_CHUNK_CHARS : MAX_CHUNK_CHARS;
    const parts = sentence.match(new RegExp(`.{1,${hardLimit}}`, 'g')) || [sentence];
    chunks.push(parts[0]);
    if (parts.length > 1) {
      const rest = parts.slice(1).join(' ');
      if (rest) current = rest;
    } else {
      current = '';
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

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

async function requestTtsAudio(endpoint: string, openaiApiKey: string, input: string, voice: string, preferredModel: string) {
  const models = Array.from(new Set([preferredModel, 'gpt-4o-mini-tts', 'tts-1']));

  let lastStatus = 0;
  let lastError = '';
  for (const model of models) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ model, input, voice, response_format: 'mp3' }),
    });

    if (res.ok) {
      const audioBuffer = await res.arrayBuffer();
      return { ok: true as const, model, audioBuffer };
    }

    lastStatus = res.status;
    const errorBody = await res.text().catch(() => '');
    lastError = errorBody.slice(0, 400);

    if (res.status === 400 && /input|length|too\s+long|maximum/i.test(errorBody)) {
      break;
    }

    if (res.status === 429 && /insufficient_quota|exceeded\s+your\s+current\s+quota/i.test(errorBody)) {
      break;
    }
  }

  return { ok: false as const, status: lastStatus, reason: lastError };
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

async function safeRecordMetric(
  supabase: SupabaseClient,
  metricName: Parameters<typeof recordAudioMetric>[2],
  metricValue = 1,
  reason?: string,
) {
  try {
    await recordAudioMetric(supabase, 'weekly_podcast', metricName, metricValue, reason);
  } catch {}
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

  const generationStartedAt = new Date().toISOString();

  await upsertStatus(supabase, payload, {
    status: 'processing',
    provider: 'openai',
    generation_started_at: generationStartedAt,
  });

  const themes = (Array.isArray(brief.themes) ? brief.themes : []) as BriefTheme[];
  const script = createPodcastScript(brief.overview || '', themes);

  const audioHash = buildAudioHash([
    'readflow-weekly-podcast',
    brief.delivery_key || payload.deliveryKey || '',
    brief.week_start,
    brief.week_end,
    brief.overview || '',
    JSON.stringify(themes),
  ]);

  let globalHit: Awaited<ReturnType<typeof getGlobalAudioCache>> = null;
  try {
    globalHit = await getGlobalAudioCache(supabase, audioHash, 'weekly_podcast');
  } catch {}

  if (globalHit?.audio_base64) {
    await safeRecordMetric(supabase, 'audio_cache_hit');
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
    await safeRecordMetric(supabase, 'audio_generation_succeeded');
    return;
  }

  await safeRecordMetric(supabase, 'audio_cache_miss');

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await upsertStatus(supabase, payload, { status: 'failed', last_error: 'OPENAI_API_KEY missing' });
    await safeRecordMetric(supabase, 'audio_generation_failed', 1, 'OPENAI_API_KEY missing');
    throw new Error('OPENAI_API_KEY missing');
  }

  const preferredModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const chunks = splitIntoSpeechChunks(script);
  const audioChunks: Buffer[] = [];
  let usedModel = preferredModel;

  for (let i = 0; i < chunks.length; i += 1) {
    const tts = await requestTtsAudio(endpoint, openaiApiKey, chunks[i], voice, preferredModel);
    if (!tts.ok) {
      const failReason = `Audio provider failed on chunk ${i + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
      await upsertStatus(supabase, payload, {
        status: 'failed',
        model: preferredModel,
        last_error: failReason,
      });
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
      throw new Error(failReason);
    }

    usedModel = tts.model;
    const chunkBuffer = Buffer.from(tts.audioBuffer);
    audioChunks.push(chunkBuffer);

    if (i === 0) {
      const firstChunkReadyAt = new Date();
      await upsertStatus(supabase, payload, {
        status: 'processing',
        model: usedModel,
        first_chunk_base64: chunkBuffer.toString('base64'),
        first_chunk_ready_at: firstChunkReadyAt.toISOString(),
        audio_hash: audioHash,
      });

      const firstChunkLatency = latencyMs(generationStartedAt, firstChunkReadyAt);
      if (firstChunkLatency !== null) await safeRecordMetric(supabase, 'audio_first_chunk_latency_ms', firstChunkLatency);
    }
  }

  const audioBase64 = Buffer.concat(audioChunks).toString('base64');

  try {
    await upsertGlobalAudioCache(supabase, {
      audioHash,
      contentType: 'weekly_podcast',
      mimeType: 'audio/mpeg',
      audioBase64,
      scriptText: script,
      provider: 'openai',
      model: usedModel,
    });
  } catch {}

  await upsertStatus(supabase, payload, {
    status: 'ready',
    model: usedModel,
    script_text: script,
    mime_type: 'audio/mpeg',
    audio_base64: audioBase64,
    audio_hash: audioHash,
    generation_completed_at: new Date().toISOString(),
    last_error: null,
  });

  const totalLatency = latencyMs(generationStartedAt);
  if (totalLatency !== null) await safeRecordMetric(supabase, 'audio_total_generation_latency_ms', totalLatency);
  await safeRecordMetric(supabase, 'audio_generation_succeeded');
}
