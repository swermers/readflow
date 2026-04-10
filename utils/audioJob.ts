import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeTokensAtomic } from '@/utils/aiEntitlements';
import { buildAudioHash, getGlobalAudioCache, normalizeAudioText, upsertGlobalAudioCache } from '@/utils/audioCache';
import { latencyMs, recordAudioMetric } from '@/utils/audioMetrics';
import { extractReadableTextFromHtml, sanitizeForSpeech, stripHtmlForSpeech } from '@/utils/audioScriptEngine';
import { generateAudioDigest } from '@/utils/audioDigest';
import { uploadAudio } from '@/utils/audioStorage';

const MAX_CHUNK_CHARS = 2500;
const FIRST_CHUNK_CHARS = 420;
const TTS_FETCH_TIMEOUT_MS = 60_000; // 60s timeout per TTS API call
const TTS_PARALLEL_BATCH_SIZE = 3;   // Process up to 3 chunks in parallel

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

async function requestTtsAudio(endpoint: string, openaiApiKey: string, input: string, voice: string, preferredModel: string) {
  // Use tts-1 as default (cheapest), with preferred model and gpt-4o-mini-tts as fallbacks
  const models = Array.from(new Set([preferredModel, 'tts-1', 'gpt-4o-mini-tts']));

  let lastStatus = 0;
  let lastError = '';
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({ model, input, voice, response_format: 'mp3' }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      lastStatus = 0;
      lastError = fetchErr instanceof Error ? fetchErr.message : 'fetch failed';
      continue;
    }
    clearTimeout(timeout);

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


async function setAudioStatus(
  supabase: SupabaseClient,
  userId: string,
  issueId: string,
  status: string,
  model?: string,
  patch?: Record<string, unknown>,
) {
  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status,
      provider: 'openai',
      model,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: 'issue_id,user_id' },
  );
}


async function safeRecordMetric(supabase: SupabaseClient, metricName: Parameters<typeof recordAudioMetric>[2], metricValue = 1, reason?: string) {
  try {
    await recordAudioMetric(supabase, 'article', metricName, metricValue, reason);
  } catch {}
}

export async function processAudioRequestedJob(supabase: SupabaseClient, userId: string, issueId: string) {
  const { data: issue } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html, from_email, received_at, senders(name)')
    .eq('id', issueId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!issue) throw new Error('Issue not found');

  const generationStartedAt = new Date().toISOString();

  await setAudioStatus(supabase, userId, issueId, 'processing', undefined, {
    generation_started_at: generationStartedAt,
  });

  const articleText = (
    issue.body_text?.trim() ||
    extractReadableTextFromHtml(issue.body_html || '') ||
    stripHtmlForSpeech(issue.body_html || '')
  ).trim();
  const contentWithoutSignoff = truncateAtSignoff(articleText);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await setAudioStatus(supabase, userId, issueId, 'failed');
    throw new Error('OPENAI_API_KEY missing');
  }

  // Check for a previously cached digest script (e.g. from a canceled generation)
  const { data: existingCache } = await supabase
    .from('issue_audio_cache')
    .select('digest_text')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  let digestText = existingCache?.digest_text || null;

  if (!digestText) {
    // Generate a digest — never send the raw article to TTS.
    // This produces a 350-500 word narration (~2-3 min audio) that covers
    // all sections, themes, key data, and takeaways.
    digestText = await generateAudioDigest(
      issue.subject || 'Newsletter article',
      contentWithoutSignoff || articleText,
    );
  }

  // If AI digest generation fails, fall back to a cleaned-up excerpt
  const scriptBody = digestText || sanitizeForSpeech(
    (contentWithoutSignoff || articleText).slice(0, 3000),
  );

  const fullScript = `${issue.subject || 'Newsletter article'}. ${scriptBody}`;

  const normalizedBody = normalizeAudioText(contentWithoutSignoff || articleText);
  const senderName = Array.isArray(issue.senders)
    ? String(issue.senders[0]?.name || '')
    : String((issue.senders as { name?: string } | null)?.name || '');
  const publishDate = issue.received_at ? new Date(issue.received_at).toISOString().slice(0, 10) : '';

  const audioHash = buildAudioHash([
    issue.subject || '',
    senderName || issue.from_email || '',
    publishDate,
    normalizedBody,
    'digest',
  ]);

  let globalHit: Awaited<ReturnType<typeof getGlobalAudioCache>> = null;
  try {
    globalHit = await getGlobalAudioCache(supabase, audioHash, 'article');
  } catch {}

  if (globalHit?.audio_base64) {
    await safeRecordMetric(supabase, 'audio_cache_hit');

    // Upload to per-user storage path
    const storagePath = await uploadAudio(supabase, {
      userId,
      type: 'article',
      filename: `${issueId}.mp3`,
      audioBuffer: Buffer.from(globalHit.audio_base64, 'base64'),
    });

    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'ready',
        mime_type: globalHit.mime_type || 'audio/mpeg',
        audio_base64: storagePath ? null : globalHit.audio_base64,
        audio_storage_path: storagePath,
        provider: globalHit.provider || 'openai',
        model: globalHit.model,
        audio_hash: audioHash,
        generation_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' },
    );
    await safeRecordMetric(supabase, 'audio_generation_succeeded');
    return;
  }

  await safeRecordMetric(supabase, 'audio_cache_miss');

  // Default to tts-1 (cheapest model) — override via env var if needed
  const preferredModel = process.env.OPENAI_TTS_MODEL || 'tts-1';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const chunks = splitIntoSpeechChunks(fullScript);
  const audioChunks: Buffer[] = [];
  let usedModel = preferredModel;

  // Process first chunk separately (needed for preview)
  {
    const tts = await requestTtsAudio(endpoint, openaiApiKey, chunks[0], voice, preferredModel);
    if (!tts.ok) {
      const failReason = `Audio provider failed on chunk 1/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
      await setAudioStatus(supabase, userId, issueId, 'failed', preferredModel);
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
      throw new Error(failReason);
    }

    usedModel = tts.model;
    const chunkBuffer = Buffer.from(tts.audioBuffer);
    audioChunks.push(chunkBuffer);

    const firstChunkReadyAt = new Date();

    // Upload preview chunk to storage
    const previewPath = await uploadAudio(supabase, {
      userId,
      type: 'preview',
      filename: `${issueId}-preview.mp3`,
      audioBuffer: chunkBuffer,
    });

    await setAudioStatus(supabase, userId, issueId, 'processing', usedModel, {
      first_chunk_base64: previewPath ? null : chunkBuffer.toString('base64'),
      first_chunk_storage_path: previewPath,
      first_chunk_ready_at: firstChunkReadyAt.toISOString(),
      audio_hash: audioHash,
      digest_text: digestText || null,
    });

    const firstChunkLatency = latencyMs(generationStartedAt, firstChunkReadyAt);
    if (firstChunkLatency !== null) await safeRecordMetric(supabase, 'audio_first_chunk_latency_ms', firstChunkLatency);
  }

  // Process remaining chunks in parallel batches for faster generation
  for (let i = 1; i < chunks.length; i += TTS_PARALLEL_BATCH_SIZE) {
    const batch = chunks.slice(i, i + TTS_PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunkText) => requestTtsAudio(endpoint, openaiApiKey, chunkText, voice, preferredModel)),
    );

    for (let j = 0; j < results.length; j += 1) {
      const tts = results[j];
      const chunkIdx = i + j;
      if (!tts.ok) {
        const failReason = `Audio provider failed on chunk ${chunkIdx + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
        await setAudioStatus(supabase, userId, issueId, 'failed', preferredModel);
        await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
        throw new Error(failReason);
      }
      usedModel = tts.model;
      audioChunks.push(Buffer.from(tts.audioBuffer));
    }
  }

  const { data: latest } = await supabase
    .from('issue_audio_cache')
    .select('status, credits_charged, credits_charged_at')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (latest?.status === 'canceled') return;

  let chargedCredits = Number(latest?.credits_charged || 0);
  let chargedAt = latest?.credits_charged_at || null;

  if (!chargedAt || chargedCredits < 10) {
    const consumeResult = await consumeTokensAtomic(supabase, userId, 10, 'Audio digest');
    if (!consumeResult.allowed) {
      await setAudioStatus(supabase, userId, issueId, 'failed', usedModel);
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, 'Insufficient credits');
      throw new Error('Insufficient credits');
    }

    chargedCredits = 10;
    chargedAt = new Date().toISOString();
  }

  const fullAudioBuffer = Buffer.concat(audioChunks);
  const audioBase64 = fullAudioBuffer.toString('base64');

  try {
    await upsertGlobalAudioCache(supabase, {
      audioHash,
      contentType: 'article',
      mimeType: 'audio/mpeg',
      audioBase64,
      scriptText: fullScript,
      provider: 'openai',
      model: usedModel,
    });
  } catch {}

  // Upload full audio to storage
  const storagePath = await uploadAudio(supabase, {
    userId,
    type: 'article',
    filename: `${issueId}.mp3`,
    audioBuffer: fullAudioBuffer,
  });

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status: 'ready',
      mime_type: 'audio/mpeg',
      audio_base64: storagePath ? null : audioBase64,
      audio_storage_path: storagePath,
      digest_text: digestText || null,
      provider: 'openai',
      model: usedModel,
      credits_charged: chargedCredits,
      credits_charged_at: chargedAt,
      audio_hash: audioHash,
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );

  const totalLatency = latencyMs(generationStartedAt);
  if (totalLatency !== null) await safeRecordMetric(supabase, 'audio_total_generation_latency_ms', totalLatency);
  await safeRecordMetric(supabase, 'audio_generation_succeeded');
}


/**
 * Pre-generate audio digest for an issue at ingest time.
 * Produces digest text + TTS audio and stores with status 'pregenerated'.
 * Credits are NOT charged here — they are charged when the user first plays.
 * If audio already exists (ready or pregenerated), this is a no-op.
 */
export async function pregenerateAudioForIssue(supabase: SupabaseClient, userId: string, issueId: string) {
  // Skip if audio is already generated or in progress
  const { data: existing } = await supabase
    .from('issue_audio_cache')
    .select('status')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status && ['ready', 'pregenerated', 'processing', 'queued'].includes(existing.status)) {
    return;
  }

  const { data: issue } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html, from_email, received_at, senders(name)')
    .eq('id', issueId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!issue) return; // Issue not found, skip silently

  const articleText = (
    issue.body_text?.trim() ||
    extractReadableTextFromHtml(issue.body_html || '') ||
    stripHtmlForSpeech(issue.body_html || '')
  ).trim();

  if (!articleText) return; // No text to generate audio for

  const contentWithoutSignoff = truncateAtSignoff(articleText);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return; // No API key, skip silently

  // Mark as processing for pregeneration
  await setAudioStatus(supabase, userId, issueId, 'processing', undefined, {
    generation_started_at: new Date().toISOString(),
  });

  // Step 1: Generate digest text (the AI "cliff notes" summary)
  let digestText: string | null = null;
  try {
    digestText = await generateAudioDigest(
      issue.subject || 'Newsletter article',
      contentWithoutSignoff || articleText,
    );
  } catch {
    // AI generation failed, fall back to extractive summary
  }

  const scriptBody = digestText || sanitizeForSpeech(
    (contentWithoutSignoff || articleText).slice(0, 3000),
  );
  const fullScript = `${issue.subject || 'Newsletter article'}. ${scriptBody}`;

  // Build hash for global cache dedup
  const normalizedBody = normalizeAudioText(contentWithoutSignoff || articleText);
  const senderName = Array.isArray(issue.senders)
    ? String(issue.senders[0]?.name || '')
    : String((issue.senders as { name?: string } | null)?.name || '');
  const publishDate = issue.received_at ? new Date(issue.received_at).toISOString().slice(0, 10) : '';

  const audioHash = buildAudioHash([
    issue.subject || '',
    senderName || issue.from_email || '',
    publishDate,
    normalizedBody,
    'digest',
  ]);

  // Check global cache first — another user may have already generated this
  let globalHit: Awaited<ReturnType<typeof getGlobalAudioCache>> = null;
  try {
    globalHit = await getGlobalAudioCache(supabase, audioHash, 'article');
  } catch {}

  if (globalHit?.audio_base64) {
    const storagePath = await uploadAudio(supabase, {
      userId,
      type: 'article',
      filename: `${issueId}.mp3`,
      audioBuffer: Buffer.from(globalHit.audio_base64, 'base64'),
    });

    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'pregenerated',
        mime_type: globalHit.mime_type || 'audio/mpeg',
        audio_base64: storagePath ? null : globalHit.audio_base64,
        audio_storage_path: storagePath,
        provider: globalHit.provider || 'openai',
        model: globalHit.model,
        audio_hash: audioHash,
        digest_text: digestText || null,
        generation_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' },
    );
    return;
  }

  // Step 2: Generate TTS audio
  const preferredModel = process.env.OPENAI_TTS_MODEL || 'tts-1';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const chunks = splitIntoSpeechChunks(fullScript);
  const audioChunks: Buffer[] = [];
  let usedModel = preferredModel;

  // Generate all chunks (first chunk separately for preview support)
  {
    const tts = await requestTtsAudio(endpoint, openaiApiKey, chunks[0], voice, preferredModel);
    if (!tts.ok) {
      // Store the digest text even if TTS fails — so on-demand generation can skip AI step
      await supabase.from('issue_audio_cache').upsert(
        {
          issue_id: issueId,
          user_id: userId,
          status: 'missing',
          digest_text: digestText || null,
          audio_hash: audioHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'issue_id,user_id' },
      );
      return;
    }

    usedModel = tts.model;
    audioChunks.push(Buffer.from(tts.audioBuffer));
  }

  // Remaining chunks in parallel batches
  for (let i = 1; i < chunks.length; i += TTS_PARALLEL_BATCH_SIZE) {
    const batch = chunks.slice(i, i + TTS_PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunkText) => requestTtsAudio(endpoint, openaiApiKey, chunkText, voice, preferredModel)),
    );

    for (let j = 0; j < results.length; j += 1) {
      const tts = results[j];
      if (!tts.ok) {
        // Partial failure — store digest text for faster on-demand fallback
        await supabase.from('issue_audio_cache').upsert(
          {
            issue_id: issueId,
            user_id: userId,
            status: 'missing',
            digest_text: digestText || null,
            audio_hash: audioHash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'issue_id,user_id' },
        );
        return;
      }
      usedModel = tts.model;
      audioChunks.push(Buffer.from(tts.audioBuffer));
    }
  }

  const fullAudioBuffer = Buffer.concat(audioChunks);
  const audioBase64 = fullAudioBuffer.toString('base64');

  // Store in global cache for cross-user dedup
  try {
    await upsertGlobalAudioCache(supabase, {
      audioHash,
      contentType: 'article',
      mimeType: 'audio/mpeg',
      audioBase64,
      scriptText: fullScript,
      provider: 'openai',
      model: usedModel,
    });
  } catch {}

  // Upload full audio to storage
  const storagePath = await uploadAudio(supabase, {
    userId,
    type: 'article',
    filename: `${issueId}.mp3`,
    audioBuffer: fullAudioBuffer,
  });

  // Store as 'pregenerated' — credits NOT charged yet
  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status: 'pregenerated',
      mime_type: 'audio/mpeg',
      audio_base64: storagePath ? null : audioBase64,
      audio_storage_path: storagePath,
      digest_text: digestText || null,
      provider: 'openai',
      model: usedModel,
      audio_hash: audioHash,
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );
}
