import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAudioHash, getGlobalAudioCache, upsertGlobalAudioCache } from '@/utils/audioCache';
import { latencyMs, recordAudioMetric } from '@/utils/audioMetrics';
import { buildAudioScript } from '@/utils/audioScriptEngine';
import { uploadAudio } from '@/utils/audioStorage';
import { hasOpenRouterKey } from '@/utils/openrouter';
import { chainStartingAt, getUserVoiceChain, speakChunk, splitIntoSpeechChunks, TTS_PARALLEL_BATCH_SIZE } from '@/utils/tts';
import type { VoiceOption } from '@/utils/voices';

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
    provider: 'openrouter',
    generation_started_at: generationStartedAt,
  });

  const themes = (Array.isArray(brief.themes) ? brief.themes : []) as BriefTheme[];
  const script = createPodcastScript(brief.overview || '', themes);

  const voiceChain = await getUserVoiceChain(supabase, payload.userId);

  const audioHash = buildAudioHash([
    'readflow-weekly-podcast',
    voiceChain[0].key,
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

    const storagePath = await uploadAudio(supabase, {
      userId: payload.userId,
      type: 'podcast',
      filename: `${payload.deliveryKey || `${payload.weekStartDate}-${payload.weekEndDate}`}.mp3`,
      audioBuffer: Buffer.from(globalHit.audio_base64, 'base64'),
    });

    await upsertStatus(supabase, payload, {
      status: 'ready',
      model: globalHit.model,
      script_text: globalHit.script_text || script,
      mime_type: globalHit.mime_type || 'audio/mpeg',
      audio_base64: storagePath ? null : globalHit.audio_base64,
      audio_storage_path: storagePath,
      audio_hash: audioHash,
      generation_completed_at: new Date().toISOString(),
      last_error: null,
    });
    await safeRecordMetric(supabase, 'audio_generation_succeeded');
    return;
  }

  await safeRecordMetric(supabase, 'audio_cache_miss');

  if (!hasOpenRouterKey()) {
    await upsertStatus(supabase, payload, { status: 'failed', last_error: 'OPENROUTER_API_KEY missing' });
    await safeRecordMetric(supabase, 'audio_generation_failed', 1, 'OPENROUTER_API_KEY missing');
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const chunks = splitIntoSpeechChunks(script);
  const audioChunks: Buffer[] = [];
  let usedVoice: VoiceOption = voiceChain[0];
  let usedModel = usedVoice.key;

  // Process first chunk separately (needed for preview / first_chunk_base64)
  {
    const tts = await speakChunk(chunks[0], voiceChain);
    if (!tts.ok) {
      const failReason = `Audio provider failed on chunk 1/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
      await upsertStatus(supabase, payload, {
        status: 'failed',
        model: usedModel,
        last_error: failReason,
      });
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
      throw new Error(failReason);
    }

    usedVoice = tts.voice;
    usedModel = usedVoice.key;
    const chunkBuffer = Buffer.from(tts.audioBuffer);
    audioChunks.push(chunkBuffer);

    const firstChunkReadyAt = new Date();

    const previewPath = await uploadAudio(supabase, {
      userId: payload.userId,
      type: 'preview',
      filename: `podcast-${payload.deliveryKey || `${payload.weekStartDate}-${payload.weekEndDate}`}-preview.mp3`,
      audioBuffer: chunkBuffer,
    });

    await upsertStatus(supabase, payload, {
      status: 'processing',
      model: usedModel,
      first_chunk_base64: previewPath ? null : chunkBuffer.toString('base64'),
      first_chunk_storage_path: previewPath,
      first_chunk_ready_at: firstChunkReadyAt.toISOString(),
      audio_hash: audioHash,
    });

    const firstChunkLatency = latencyMs(generationStartedAt, firstChunkReadyAt);
    if (firstChunkLatency !== null) await safeRecordMetric(supabase, 'audio_first_chunk_latency_ms', firstChunkLatency);
  }

  // Process remaining chunks in parallel batches
  for (let i = 1; i < chunks.length; i += TTS_PARALLEL_BATCH_SIZE) {
    const batch = chunks.slice(i, i + TTS_PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunkText) => speakChunk(chunkText, chainStartingAt(voiceChain, usedVoice))),
    );

    for (let j = 0; j < results.length; j += 1) {
      const tts = results[j];
      const chunkIdx = i + j;
      if (!tts.ok) {
        const failReason = `Audio provider failed on chunk ${chunkIdx + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
        await upsertStatus(supabase, payload, {
          status: 'failed',
          model: usedModel,
          last_error: failReason,
        });
        await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
        throw new Error(failReason);
      }
      usedModel = tts.voice.key;
      audioChunks.push(Buffer.from(tts.audioBuffer));
    }
  }

  const fullAudioBuffer = Buffer.concat(audioChunks);
  const audioBase64 = fullAudioBuffer.toString('base64');

  try {
    await upsertGlobalAudioCache(supabase, {
      audioHash,
      contentType: 'weekly_podcast',
      mimeType: 'audio/mpeg',
      audioBase64,
      scriptText: script,
      provider: 'openrouter',
      model: usedModel,
    });
  } catch {}

  const storagePath = await uploadAudio(supabase, {
    userId: payload.userId,
    type: 'podcast',
    filename: `${payload.deliveryKey || `${payload.weekStartDate}-${payload.weekEndDate}`}.mp3`,
    audioBuffer: fullAudioBuffer,
  });

  await upsertStatus(supabase, payload, {
    status: 'ready',
    model: usedModel,
    script_text: script,
    mime_type: 'audio/mpeg',
    audio_base64: storagePath ? null : audioBase64,
    audio_storage_path: storagePath,
    audio_hash: audioHash,
    generation_completed_at: new Date().toISOString(),
    last_error: null,
  });

  const totalLatency = latencyMs(generationStartedAt);
  if (totalLatency !== null) await safeRecordMetric(supabase, 'audio_total_generation_latency_ms', totalLatency);
  await safeRecordMetric(supabase, 'audio_generation_succeeded');
}
