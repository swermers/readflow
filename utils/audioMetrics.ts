import type { SupabaseClient } from '@supabase/supabase-js';

type AudioMetricName =
  | 'audio_cache_hit'
  | 'audio_cache_miss'
  | 'audio_generation_failed'
  | 'audio_generation_succeeded'
  | 'audio_first_chunk_latency_ms'
  | 'audio_total_generation_latency_ms';

export async function recordAudioMetric(
  supabase: SupabaseClient,
  contentType: 'article' | 'weekly_podcast',
  metricName: AudioMetricName,
  metricValue = 1,
  reason?: string,
) {
  await supabase.from('audio_generation_metrics').insert({
    content_type: contentType,
    metric_name: metricName,
    metric_value: metricValue,
    reason: reason || null,
    created_at: new Date().toISOString(),
  });
}

export function latencyMs(startIso: string | null | undefined, endDate = new Date()) {
  if (!startIso) return null;
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) return null;
  const ms = endDate.getTime() - startMs;
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms;
}
