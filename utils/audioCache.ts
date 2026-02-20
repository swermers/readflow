import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type GlobalCacheRecord = {
  audio_hash: string;
  content_type: 'article' | 'weekly_podcast';
  mime_type: string;
  audio_base64: string;
  script_text: string | null;
  provider: string | null;
  model: string | null;
};

export function normalizeAudioText(input: string) {
  return input.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function buildAudioHash(parts: Array<string | null | undefined>) {
  const joined = parts.map((part) => normalizeAudioText(part || '')).join('|');
  return createHash('sha256').update(joined).digest('hex');
}

export async function getGlobalAudioCache(
  supabase: SupabaseClient,
  audioHash: string,
  contentType: 'article' | 'weekly_podcast',
) {
  const { data } = await supabase
    .from('audio_global_cache')
    .select('audio_hash, content_type, mime_type, audio_base64, script_text, provider, model')
    .eq('audio_hash', audioHash)
    .eq('content_type', contentType)
    .maybeSingle();

  return (data || null) as GlobalCacheRecord | null;
}

export async function upsertGlobalAudioCache(
  supabase: SupabaseClient,
  row: {
    audioHash: string;
    contentType: 'article' | 'weekly_podcast';
    mimeType: string;
    audioBase64: string;
    scriptText?: string | null;
    provider?: string | null;
    model?: string | null;
  },
) {
  await supabase.from('audio_global_cache').upsert(
    {
      audio_hash: row.audioHash,
      content_type: row.contentType,
      mime_type: row.mimeType,
      audio_base64: row.audioBase64,
      script_text: row.scriptText || null,
      provider: row.provider || null,
      model: row.model || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'audio_hash' },
  );
}
