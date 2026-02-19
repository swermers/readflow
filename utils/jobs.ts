import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType = 'briefing.generate' | 'audio.requested' | 'notion.sync';

export async function enqueueJob(
  supabase: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
  dedupeKey: string,
  maxAttempts = 5,
) {
  const { error } = await supabase.rpc('enqueue_background_job', {
    p_type: type,
    p_payload: payload,
    p_dedupe_key: dedupeKey,
    p_max_attempts: maxAttempts,
  });

  if (error) throw error;
}

export async function claimQueuedJobs(
  supabase: SupabaseClient,
  type: JobType,
  workerId: string,
  limit = 25,
  leaseSeconds = 180,
): Promise<BackgroundJob[]> {
  const { data, error } = await supabase.rpc('claim_background_jobs', {
    p_type: type,
    p_limit: limit,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });

  if (error) throw error;
  return (data || []) as BackgroundJob[];
}

export async function markJobComplete(supabase: SupabaseClient, id: string, workerId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('background_jobs')
    .update({
      status: 'completed',
      completed_at: now,
      lock_expires_at: null,
      locked_at: null,
      locked_by: null,
      dead_letter_reason: null,
      failed_at: null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'processing')
    .eq('locked_by', workerId);

  if (error) throw error;
}

export async function markJobFailed(
  supabase: SupabaseClient,
  job: Pick<BackgroundJob, 'id' | 'attempts' | 'max_attempts'>,
  workerId: string,
  errorMessage: string,
) {
  const nextAttempt = Number(job.attempts || 0) + 1;
  const reachedMaxAttempts = nextAttempt >= Number(job.max_attempts || 5);
  const delaySeconds = reachedMaxAttempts ? 0 : getRetryDelaySeconds(nextAttempt);
  const now = new Date();
  const nextAvailableAt = new Date(now.getTime() + delaySeconds * 1000).toISOString();

  const { error } = await supabase
    .from('background_jobs')
    .update({
      status: reachedMaxAttempts ? 'dead_letter' : 'queued',
      attempts: nextAttempt,
      available_at: reachedMaxAttempts ? now.toISOString() : nextAvailableAt,
      last_error: errorMessage.slice(0, 1000),
      last_error_at: now.toISOString(),
      failed_at: reachedMaxAttempts ? now.toISOString() : null,
      dead_letter_reason: reachedMaxAttempts ? 'max_attempts_reached' : null,
      lock_expires_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: now.toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('locked_by', workerId);

  if (error) throw error;
}

export async function replayDeadLetterJobs(
  supabase: SupabaseClient,
  type: JobType,
  limit = 50,
  reason = 'manual_replay',
) {
  const { data: candidates, error: selectError } = await supabase
    .from('background_jobs')
    .select('id')
    .eq('type', type)
    .eq('status', 'dead_letter')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (selectError) throw selectError;
  const ids = (candidates || []).map((job) => job.id);
  if (!ids.length) return { replayed: 0, reason };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('background_jobs')
    .update({
      status: 'queued',
      attempts: 0,
      available_at: now,
      failed_at: null,
      dead_letter_reason: null,
      last_error: null,
      last_error_at: null,
      lock_expires_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .in('id', ids)
    .eq('status', 'dead_letter');

  if (updateError) throw updateError;
  return { replayed: ids.length, reason };
}
