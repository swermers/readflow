import type { SupabaseClient } from '@supabase/supabase-js';

const AUDIO_BUCKET = 'audio';

/**
 * Upload audio binary to Supabase Storage and return the storage path.
 * Path convention: {userId}/{type}/{filename}.mp3
 */
export async function uploadAudio(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    type: 'article' | 'podcast' | 'global' | 'preview';
    filename: string;
    audioBuffer: Buffer;
    mimeType?: string;
  },
): Promise<string | null> {
  const path = `${opts.userId}/${opts.type}/${opts.filename}`;
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, opts.audioBuffer, {
      contentType: opts.mimeType || 'audio/mpeg',
      upsert: true,
    });

  if (error) {
    console.error('[audioStorage] upload failed:', path, error.message);
    return null;
  }
  return path;
}

/**
 * Upload a global (cross-user) audio file. Uses a shared prefix.
 */
export async function uploadGlobalAudio(
  supabase: SupabaseClient,
  opts: {
    audioHash: string;
    contentType: 'article' | 'weekly_podcast';
    audioBuffer: Buffer;
    mimeType?: string;
  },
): Promise<string | null> {
  const path = `global/${opts.contentType}/${opts.audioHash}.mp3`;
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, opts.audioBuffer, {
      contentType: opts.mimeType || 'audio/mpeg',
      upsert: true,
    });

  if (error) {
    console.error('[audioStorage] global upload failed:', path, error.message);
    return null;
  }
  return path;
}

/**
 * Download audio from Supabase Storage, returning a Buffer.
 * Returns null if the file doesn't exist or download fails.
 */
export async function downloadAudio(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .download(storagePath);

  if (error || !data) {
    console.error('[audioStorage] download failed:', storagePath, error?.message);
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Convert a base64 string to a Buffer for upload.
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}
