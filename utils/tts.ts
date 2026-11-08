import type { SupabaseClient } from '@supabase/supabase-js';
import { synthesizeSpeech } from '@/utils/openrouter';
import { voiceAttemptChain, type VoiceOption } from '@/utils/voices';

const MAX_CHUNK_CHARS = 2500;
const FIRST_CHUNK_CHARS = 420;
export const TTS_PARALLEL_BATCH_SIZE = 3;

export function splitIntoSpeechChunks(input: string) {
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

export type ChunkAudioResult =
  | { ok: true; audioBuffer: ArrayBuffer; voice: VoiceOption }
  | { ok: false; status: number; reason: string };

/**
 * Voice one chunk, trying each voice in the chain until one succeeds.
 * Stops early on errors no other voice would fix (no credit, bad key).
 */
export async function speakChunk(input: string, chain: VoiceOption[]): Promise<ChunkAudioResult> {
  let lastStatus = 0;
  let lastReason = 'No voices configured';

  for (const voice of chain) {
    const result = await synthesizeSpeech(voice.model, voice.voice, input);
    if (result.ok) return { ok: true, audioBuffer: result.audioBuffer, voice };

    lastStatus = result.status;
    lastReason = `${voice.model} (${voice.voice}): ${result.reason}`;
    if (result.status === 401 || result.status === 402 || result.reason.includes('OPENROUTER_API_KEY')) break;
  }

  return { ok: false, status: lastStatus, reason: lastReason };
}

/** Chain to use for the rest of a script once a voice has worked for the first chunk. */
export function chainStartingAt(chain: VoiceOption[], voice: VoiceOption) {
  const index = chain.findIndex((option) => option.key === voice.key);
  return index === -1 ? [voice, ...chain] : chain.slice(index);
}

export async function getUserVoiceChain(supabase: SupabaseClient, userId: string) {
  let key: string | null = null;
  try {
    const { data } = await supabase
      .from('profile_preferences')
      .select('tts_voice')
      .eq('user_id', userId)
      .maybeSingle<{ tts_voice: string | null }>();
    key = data?.tts_voice ?? null;
  } catch {
    // Column missing (migration not applied yet) or row missing: use the default voice.
  }
  return voiceAttemptChain(key);
}
