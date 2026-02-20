import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeTokensAtomic } from '@/utils/aiEntitlements';

const MAX_CHUNK_CHARS = 2500;

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
    .replace(/\bhttps?:\/\/[^\s]+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
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

function splitIntoSpeechChunks(input: string) {
  if (input.length <= MAX_CHUNK_CHARS) return [input];

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
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= MAX_CHUNK_CHARS) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = sentence;
      continue;
    }

    const parts = sentence.match(new RegExp(`.{1,${MAX_CHUNK_CHARS}}`, 'g')) || [sentence];
    chunks.push(...parts);
    current = '';
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
  }

  return { ok: false as const, status: lastStatus, reason: lastError };
}

async function setAudioStatus(supabase: SupabaseClient, userId: string, issueId: string, status: string, model?: string) {
  await supabase.from('issue_audio_cache').upsert(
    {
      issue_id: issueId,
      user_id: userId,
      status,
      provider: 'openai',
      model,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );
}

export async function processAudioRequestedJob(supabase: SupabaseClient, userId: string, issueId: string) {
  const { data: issue } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html')
    .eq('id', issueId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!issue) throw new Error('Issue not found');

  await setAudioStatus(supabase, userId, issueId, 'processing');

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    await setAudioStatus(supabase, userId, issueId, 'failed');
    throw new Error('OPENAI_API_KEY missing');
  }

  const articleText = (issue.body_text?.trim() || stripHtml(issue.body_html || '')).trim();
  const contentWithoutSignoff = truncateAtSignoff(articleText);
  const speechText = sanitizeForSpeech(contentWithoutSignoff || articleText);
  const fullInput = `${issue.subject || 'Newsletter article'}\n\n${speechText}`;

  const preferredModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const endpoint = process.env.OPENAI_AUDIO_ENDPOINT || 'https://api.openai.com/v1/audio/speech';

  const chunks = splitIntoSpeechChunks(fullInput);
  const audioChunks: Buffer[] = [];
  let usedModel = preferredModel;

  for (let i = 0; i < chunks.length; i += 1) {
    const tts = await requestTtsAudio(endpoint, openaiApiKey, chunks[i], voice, preferredModel);
    if (!tts.ok) {
      await setAudioStatus(supabase, userId, issueId, 'failed', preferredModel);
      throw new Error(`Audio provider failed on chunk ${i + 1}/${chunks.length}: ${tts.status}${tts.reason ? ` ${tts.reason}` : ''}`);
    }

    usedModel = tts.model;
    audioChunks.push(Buffer.from(tts.audioBuffer));
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
      throw new Error('Insufficient credits');
    }

    chargedCredits = 10;
    chargedAt = new Date().toISOString();
  }

  const audioBase64 = Buffer.concat(audioChunks).toString('base64');

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
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,user_id' },
  );
}
