import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType = 'briefing.generate' | 'audio.requested';

export async function enqueueJob(
  supabase: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
  dedupeKey: string,
) {
  const { error } = await supabase.from('background_jobs').upsert(
    {
      type,
      payload,
      dedupe_key: dedupeKey,
      status: 'queued',
      attempts: 0,
      last_error: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dedupe_key' },
  );

  if (error) throw error;
}

export async function claimQueuedJobs(supabase: SupabaseClient, type: JobType, limit = 25) {
  const { data: jobs, error } = await supabase
    .from('background_jobs')
    .select('id, type, payload, attempts')
    .eq('type', type)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!jobs?.length) return [];

  const ids = jobs.map((job) => job.id);
  const { error: markError } = await supabase
    .from('background_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'queued');

  if (markError) throw markError;
  return jobs;
}

export async function markJobComplete(supabase: SupabaseClient, id: string) {
  await supabase
    .from('background_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markJobFailed(supabase: SupabaseClient, id: string, attempts: number, errorMessage: string) {
  await supabase
    .from('background_jobs')
    .update({
      status: attempts >= 3 ? 'failed' : 'queued',
      attempts: attempts + 1,
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}
