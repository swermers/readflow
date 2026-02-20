import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType = 'briefing.generate' | 'audio.requested' | 'notion.sync';

export type BackgroundJob = {
  id: string;
  type: JobType;
  payload: Record<string, unknown> | null;
  attempts: number | null;
  max_attempts: number | null;
  queue_latency_ms?: number | null;
  locked_by?: string | null;
  lease_expires_at?: string | null;
};

type EnqueueOptions = {
  maxAttempts?: number;
};

type EnqueueArg = number | EnqueueOptions | undefined;

function resolveMaxAttempts(arg: EnqueueArg) {
  if (typeof arg === 'number' && Number.isFinite(arg)) return Math.max(1, Math.floor(arg));
  if (arg && typeof arg === 'object' && typeof arg.maxAttempts === 'number' && Number.isFinite(arg.maxAttempts)) {
    return Math.max(1, Math.floor(arg.maxAttempts));
  }
  return 5;
}

const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800];

function getBackoffSeconds(attempts: number) {
  const safeAttempts = Math.max(1, attempts);
  const idx = Math.min(safeAttempts - 1, RETRY_BACKOFF_SECONDS.length - 1);
  return RETRY_BACKOFF_SECONDS[idx];
}

export async function enqueueJob(
  supabase: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
  dedupeKey: string,
  options: EnqueueArg = {},
) {
  const maxAttempts = resolveMaxAttempts(options);
  const { data, error } = await supabase.rpc('enqueue_background_job', {
    p_type: type,
    p_dedupe_key: dedupeKey,
    p_payload: payload,
    p_max_attempts: maxAttempts,
  });

  if (!error) return data;

  // Backward-compatible fallback for environments before migration 022 is applied.
  const { error: upsertError } = await supabase.from('background_jobs').upsert(
    {
      type,
      payload,
      dedupe_key: dedupeKey,
      status: 'queued',
      attempts: 0,
      max_attempts: maxAttempts,
      retry_at: new Date().toISOString(),
      last_error: null,
      completed_at: null,
      dead_lettered_at: null,
      locked_by: null,
      locked_at: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dedupe_key' },
  );

  if (upsertError) throw upsertError;
  return null;
}

export async function claimQueuedJobs(
  supabase: SupabaseClient,
  type: JobType,
  workerId: string,
  limit = 25,
  leaseSeconds = 240,
): Promise<BackgroundJob[]> {
  const { data, error } = await supabase.rpc('claim_background_jobs', {
    p_type: type,
    p_worker_id: workerId,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });

  if (!error && Array.isArray(data)) {
    const now = Date.now();
    return data.map((job) => ({
      ...job,
      queue_latency_ms: now - new Date(job.created_at as string).getTime(),
    })) as BackgroundJob[];
  }

  const { data: jobs, error: fallbackError } = await supabase
    .from('background_jobs')
    .select('id, type, payload, attempts, max_attempts, created_at')
    .eq('type', type)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (fallbackError) throw fallbackError;
  if (!jobs?.length) return [];

  const ids = jobs.map((job) => job.id);
  const { error: markError } = await supabase
    .from('background_jobs')
    .update({
      status: 'processing',
      locked_by: workerId,
      locked_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'queued');

  if (markError) throw markError;

  const now = Date.now();
  return jobs.map((job) => ({
    id: job.id,
    type: job.type as JobType,
    payload: (job.payload as Record<string, unknown>) || {},
    attempts: Number(job.attempts || 0) + 1,
    max_attempts: Number(job.max_attempts || 5),
    queue_latency_ms: now - new Date(job.created_at as string).getTime(),
    locked_by: workerId,
  }));
}

export async function markJobComplete(supabase: SupabaseClient, id: string, workerId: string) {
  const { error } = await supabase
    .from('background_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lease_expires_at: null,
    })
    .eq('id', id)
    .eq('locked_by', workerId);

  if (error) throw error;
}

export async function markJobFailed(supabase: SupabaseClient, job: BackgroundJob, workerId: string, errorMessage: string) {
  const attempts = Number(job.attempts || 1);
  const maxAttempts = Number(job.max_attempts || 5);
  const isDeadLetter = attempts >= maxAttempts;

  const patch = isDeadLetter
    ? {
        status: 'dead_letter',
        dead_lettered_at: new Date().toISOString(),
        retry_at: null,
        lease_expires_at: null,
        last_error: errorMessage.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }
    : {
        status: 'failed',
        retry_at: new Date(Date.now() + getBackoffSeconds(attempts) * 1000).toISOString(),
        lease_expires_at: null,
        last_error: errorMessage.slice(0, 1000),
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabase.from('background_jobs').update(patch).eq('id', job.id).eq('locked_by', workerId);
  if (error) throw error;
}
