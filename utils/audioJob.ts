import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeTokensAtomic } from '@/utils/aiEntitlements';
import { buildAudioHash, getGlobalAudioCache, normalizeAudioText, upsertGlobalAudioCache } from '@/utils/audioCache';
import { latencyMs, recordAudioMetric } from '@/utils/audioMetrics';
import { extractReadableTextFromHtml, sanitizeForSpeech, stripHtmlForSpeech } from '@/utils/audioScriptEngine';
import { generateAudioDigest } from '@/utils/audioDigest';
import { uploadAudio } from '@/utils/audioStorage';
import { hasOpenRouterKey } from '@/utils/openrouter';
import { chainStartingAt, getUserVoiceChain, speakChunk, splitIntoSpeechChunks, TTS_PARALLEL_BATCH_SIZE } from '@/utils/tts';
import type { VoiceOption } from '@/utils/voices';

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
      provider: 'openrouter',
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

  if (!hasOpenRouterKey()) {
    await setAudioStatus(supabase, userId, issueId, 'failed');
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const voiceChain = await getUserVoiceChain(supabase, userId);

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
    voiceChain[0].key,
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
        provider: globalHit.provider || 'openrouter',
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

  const chunks = splitIntoSpeechChunks(fullScript);
  const audioChunks: Buffer[] = [];
  let usedVoice: VoiceOption = voiceChain[0];
  let usedModel = usedVoice.key;

  // Process first chunk separately (needed for preview)
  {
    const tts = await speakChunk(chunks[0], voiceChain);
    if (!tts.ok) {
      const failReason = `Audio provider failed on chunk 1/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
      await setAudioStatus(supabase, userId, issueId, 'failed', usedModel);
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
      throw new Error(failReason);
    }

    usedVoice = tts.voice;
    usedModel = usedVoice.key;
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
      batch.map((chunkText) => speakChunk(chunkText, chainStartingAt(voiceChain, usedVoice))),
    );

    for (let j = 0; j < results.length; j += 1) {
      const tts = results[j];
      const chunkIdx = i + j;
      if (!tts.ok) {
        const failReason = `Audio provider failed on chunk ${chunkIdx + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
        await setAudioStatus(supabase, userId, issueId, 'failed', usedModel);
        await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
        throw new Error(failReason);
      }
      usedModel = tts.voice.key;
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
      provider: 'openrouter',
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
      provider: 'openrouter',
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

  if (!hasOpenRouterKey()) return; // No API key, skip silently

  const voiceChain = await getUserVoiceChain(supabase, userId);

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
    voiceChain[0].key,
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
        provider: globalHit.provider || 'openrouter',
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

  // Step 2: Generate TTS audio — only when pregeneration is switched on.
  // Voicing every incoming newsletter costs money even if it is never played,
  // so by default we keep just the (cheap) digest text and voice on demand.
  if (process.env.AUDIO_PREGENERATE_TTS !== 'true') {
    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'missing',
        digest_text: digestText || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,user_id' },
    );
    return;
  }

  const chunks = splitIntoSpeechChunks(fullScript);
  const audioChunks: Buffer[] = [];
  let usedVoice: VoiceOption = voiceChain[0];
  let usedModel = usedVoice.key;

  // Generate all chunks (first chunk separately for preview support)
  {
    const tts = await speakChunk(chunks[0], voiceChain);
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

    usedVoice = tts.voice;
    usedModel = usedVoice.key;
    audioChunks.push(Buffer.from(tts.audioBuffer));
  }

  // Remaining chunks in parallel batches
  for (let i = 1; i < chunks.length; i += TTS_PARALLEL_BATCH_SIZE) {
    const batch = chunks.slice(i, i + TTS_PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunkText) => speakChunk(chunkText, chainStartingAt(voiceChain, usedVoice))),
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
      usedModel = tts.voice.key;
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
      provider: 'openrouter',
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
      provider: 'openrouter',
      model: usedModel,
      audio_hash: audioHash,
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );
}
