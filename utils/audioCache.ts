import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { downloadAudio, uploadGlobalAudio } from '@/utils/audioStorage';

type GlobalCacheRecord = {
  audio_hash: string;
  content_type: 'article' | 'weekly_podcast';
  mime_type: string;
  audio_base64: string | null;
  audio_storage_path: string | null;
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
    .select('audio_hash, content_type, mime_type, audio_base64, audio_storage_path, script_text, provider, model')
    .eq('audio_hash', audioHash)
    .eq('content_type', contentType)
    .maybeSingle();

  if (!data) return null;

  // Prefer storage path over inline base64
  if (data.audio_storage_path && !data.audio_base64) {
    const buf = await downloadAudio(supabase, data.audio_storage_path);
    if (buf) {
      data.audio_base64 = buf.toString('base64');
    }
  }

  return data as GlobalCacheRecord;
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
  // Upload to storage instead of storing inline
  const storagePath = await uploadGlobalAudio(supabase, {
    audioHash: row.audioHash,
    contentType: row.contentType,
    audioBuffer: Buffer.from(row.audioBase64, 'base64'),
    mimeType: row.mimeType,
  });

  await supabase.from('audio_global_cache').upsert(
    {
      audio_hash: row.audioHash,
      content_type: row.contentType,
      mime_type: row.mimeType,
      audio_base64: storagePath ? null : row.audioBase64, // only store inline as fallback
      audio_storage_path: storagePath,
      script_text: row.scriptText || null,
      provider: row.provider || null,
      model: row.model || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'audio_hash' },
  );
}
