import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeTokensAtomic } from '@/utils/aiEntitlements';
import { buildAudioHash, getGlobalAudioCache, normalizeAudioText, upsertGlobalAudioCache } from '@/utils/audioCache';
import { latencyMs, recordAudioMetric } from '@/utils/audioMetrics';
import { buildAudioScript, extractReadableTextFromHtml, sanitizeForSpeech, stripHtmlForSpeech } from '@/utils/audioScriptEngine';

const MAX_CHUNK_CHARS = 2500;
const FIRST_CHUNK_CHARS = 420;
const ABBREVIATED_WORD_THRESHOLD = Number(process.env.AUDIO_ABBREVIATED_WORD_THRESHOLD || 1200);

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


async function generateAbbreviatedBodyWithAi(openaiApiKey: string, subject: string, rawBody: string) {
  const model = process.env.OPENAI_ABBREVIATION_MODEL || 'gpt-4o-mini';
  const endpoint = process.env.OPENAI_CHAT_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const snippet = rawBody.slice(0, 16000);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You create concise but deep audio briefing scripts. Keep all core ideas, evidence, and important tradeoffs. Output plain text only. No markdown or bullets.',
        },
        {
          role: 'user',
          content:
            `Create an abbreviated cliff-notes narration for this article while preserving depth. Use 6 to 10 sentences. Keep sequence coherent and natural.

Title: ${subject}

Article:
${snippet}`,
        },
      ],
      max_tokens: 550,
    }),
  });

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return sanitizeForSpeech(text);
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
  const wordCount = (contentWithoutSignoff || articleText).split(/\s+/).filter(Boolean).length;
  const audioMode: 'full' | 'abbreviated' = wordCount >= ABBREVIATED_WORD_THRESHOLD ? 'abbreviated' : 'full';

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await setAudioStatus(supabase, userId, issueId, 'failed');
    throw new Error('OPENAI_API_KEY missing');
  }

  const abbreviatedBody =
    audioMode === 'abbreviated'
      ? await generateAbbreviatedBodyWithAi(openaiApiKey, issue.subject || 'Newsletter article', contentWithoutSignoff || articleText).catch(() => null)
      : null;

  const built = buildAudioScript({
    title: issue.subject || 'Newsletter article',
    rawText: contentWithoutSignoff || articleText,
    mode: audioMode,
    abbreviatedBodyOverride: abbreviatedBody || undefined,
  });

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
    audioMode,
  ]);

  let globalHit: Awaited<ReturnType<typeof getGlobalAudioCache>> = null;
  try {
    globalHit = await getGlobalAudioCache(supabase, audioHash, 'article');
  } catch {}

  if (globalHit?.audio_base64) {
    await safeRecordMetric(supabase, 'audio_cache_hit');
    await supabase.from('issue_audio_cache').upsert(
      {
        issue_id: issueId,
        user_id: userId,
        status: 'ready',
        mime_type: globalHit.mime_type || 'audio/mpeg',
        audio_base64: globalHit.audio_base64,
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

  const fullInput = `${issue.subject || 'Newsletter article'}\n\n${built.script}`;

  const preferredModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const chunks = splitIntoSpeechChunks(fullInput);
  const audioChunks: Buffer[] = [];
  let usedModel = preferredModel;

  for (let i = 0; i < chunks.length; i += 1) {
    const tts = await requestTtsAudio(endpoint, openaiApiKey, chunks[i], voice, preferredModel);
    if (!tts.ok) {
      const failReason = `Audio provider failed on chunk ${i + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`;
      await setAudioStatus(supabase, userId, issueId, 'failed', preferredModel);
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, failReason);
      throw new Error(failReason);
    }

    usedModel = tts.model;
    const chunkBuffer = Buffer.from(tts.audioBuffer);
    audioChunks.push(chunkBuffer);

    if (i === 0) {
      const firstChunkReadyAt = new Date();
      await setAudioStatus(supabase, userId, issueId, 'processing', usedModel, {
        first_chunk_base64: chunkBuffer.toString('base64'),
        first_chunk_ready_at: firstChunkReadyAt.toISOString(),
        audio_hash: audioHash,
      });

      const firstChunkLatency = latencyMs(generationStartedAt, firstChunkReadyAt);
      if (firstChunkLatency !== null) await safeRecordMetric(supabase, 'audio_first_chunk_latency_ms', firstChunkLatency);
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
    const consumeResult = await consumeTokensAtomic(supabase, userId, 10);
    if (!consumeResult.allowed) {
      await setAudioStatus(supabase, userId, issueId, 'failed', usedModel);
      await safeRecordMetric(supabase, 'audio_generation_failed', 1, 'Insufficient credits');
      throw new Error('Insufficient credits');
    }

    chargedCredits = 10;
    chargedAt = new Date().toISOString();
  }

  const audioBase64 = Buffer.concat(audioChunks).toString('base64');

  try {
    await upsertGlobalAudioCache(supabase, {
      audioHash,
      contentType: 'article',
      mimeType: 'audio/mpeg',
      audioBase64,
      scriptText: built.script,
      provider: 'openai',
      model: usedModel,
    });
  } catch {}

  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status: 'ready',
      mime_type: 'audio/mpeg',
      audio_base64: audioBase64,
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
