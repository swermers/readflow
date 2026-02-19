import type { SupabaseClient } from '@supabase/supabase-js';

export const JOB_TYPES = ['briefing.generate', 'audio.requested'] as const;

export type JobType = (typeof JOB_TYPES)[number];

type JobPayloadByType = {
  'briefing.generate': {
    userId: string;
    weekStartDate?: string;
  };
  'audio.requested': {
    userId: string;
    issueId: string;
  };
};

type BackgroundJobBase = {
  id: string;
  attempts: number;
  max_attempts: number;
  dedupe_key: string;
  created_at: string;
  queue_latency_ms: number | null;
};

export type BackgroundJobByType = {
  [T in JobType]: BackgroundJobBase & {
    type: T;
    payload: JobPayloadByType[T];
  };
};

export type BackgroundJob<T extends JobType = JobType> = BackgroundJobByType[T];

type EnqueueJobInput<T extends JobType> = {
  supabase: SupabaseClient;
  type: T;
  payload: JobPayloadByType[T];
  dedupeKey: string;
  maxAttempts?: number;
};

type ClaimQueuedJobsInput<T extends JobType> = {
  supabase: SupabaseClient;
  type: T;
  workerId: string;
  limit?: number;
  leaseSeconds?: number;
};

type MarkJobCompleteInput = {
  supabase: SupabaseClient;
  id: string;
  workerId: string;
};

type MarkJobFailedInput = {
  supabase: SupabaseClient;
  job: Pick<BackgroundJob, 'id' | 'attempts' | 'max_attempts'>;
  workerId: string;
  errorMessage: string;
};

type ReplayDeadLetterJobsInput<T extends JobType> = {
  supabase: SupabaseClient;
  type: T;
  limit?: number;
  reason?: string;
};

const MAX_RETRY_DELAY_SECONDS = 60 * 60;
const BASE_RETRY_DELAY_SECONDS = 30;

export function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

function getRetryDelaySeconds(nextAttempt: number) {
  const exponentialDelay = BASE_RETRY_DELAY_SECONDS * 2 ** Math.max(nextAttempt - 1, 0);
  return Math.min(exponentialDelay, MAX_RETRY_DELAY_SECONDS);
}

export async function enqueueJob<T extends JobType>({
  supabase,
  type,
  payload,
  dedupeKey,
  maxAttempts = 5,
}: EnqueueJobInput<T>) {
  const { error } = await supabase.rpc('enqueue_background_job', {
    p_type: type,
    p_payload: payload,
    p_dedupe_key: dedupeKey,
    p_max_attempts: maxAttempts,
  });

  if (error) throw error;
}

export async function claimQueuedJobs<T extends JobType>({
  supabase,
  type,
  workerId,
  limit = 25,
  leaseSeconds = 180,
}: ClaimQueuedJobsInput<T>): Promise<BackgroundJob<T>[]> {
  const { data, error } = await supabase.rpc('claim_background_jobs', {
    p_type: type,
    p_limit: limit,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });

  if (error) throw error;
  return (data || []) as BackgroundJob<T>[];
}

export async function markJobComplete({ supabase, id, workerId }: MarkJobCompleteInput) {
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

export async function markJobFailed({ supabase, job, workerId, errorMessage }: MarkJobFailedInput) {
  const nextAttempt = Number(job.attempts || 0) + 1;
  const reachedMaxAttempts = nextAttempt >= Number(job.max_attempts || 5);
  const delaySeconds = reachedMaxAttempts ? 0 : getRetryDelaySeconds(nextAttempt);
  const now = new Date();
  const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000).toISOString();

  const { error } = await supabase
    .from('background_jobs')
    .update({
      status: reachedMaxAttempts ? 'dead_letter' : 'queued',
      attempts: nextAttempt,
      next_attempt_at: reachedMaxAttempts ? now.toISOString() : nextAttemptAt,
      available_at: reachedMaxAttempts ? now.toISOString() : nextAttemptAt,
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
  return { deadLettered: reachedMaxAttempts };
}

export async function replayDeadLetterJobs<T extends JobType>({
  supabase,
  type,
  limit = 50,
  reason = 'manual_replay',
}: ReplayDeadLetterJobsInput<T>) {
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
      next_attempt_at: now,
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
