export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
  claimQueuedJobs,
  type JobType,
  markJobComplete,
  markJobFailed,
  type BackgroundJob,
} from '@/utils/jobs';
import { processAudioRequestedJob } from '@/utils/audioJob';
import { createAdminClient } from '@/utils/supabase/admin';
import { processNotionSyncJob } from '@/utils/notionSyncJob';
import { generateWeeklyBriefForUser } from '@/utils/weeklyBrief';
import { NextResponse } from 'next/server';

type ProcessResult = {
  claimed: number;
  processed: number;
  failed: number;
  deadLettered: number;
  avgQueueLatencyMs: number;
};

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

async function runJob(supabase: ReturnType<typeof createAdminClient>, job: BackgroundJob) {
  if (job.type === 'briefing.generate') {
    const userId = job.payload?.userId;
    if (!userId) throw new Error('Missing userId payload');
    await generateWeeklyBriefForUser(supabase, userId, true);
    return;
  }

  if (job.type === 'audio.requested') {
    const userId = job.payload?.userId;
    const issueId = job.payload?.issueId;
    if (!userId || !issueId) throw new Error('Missing userId or issueId payload');
    await processAudioRequestedJob(supabase, userId, issueId);
    return;
  }

  const unsupported: never = job;
  throw new Error(`Unsupported job type: ${String(unsupported)}`);
}

async function processJobsByType(type: JobType, workerId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const jobs = await claimQueuedJobs({
    supabase,
    type,
    workerId,
    limit: 25,
    leaseSeconds: 240,
  });

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      await runJob(supabase, job);
      await markJobComplete({ supabase, id: job.id, workerId });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Job failed';
      const result = await markJobFailed({ supabase, job, workerId, errorMessage: message });
      failed += 1;
      if (result.deadLettered) deadLettered += 1;
    }
  }

  return {
    claimed: jobs.length,
    processed,
    failed,
    deadLettered,
    avgQueueLatencyMs: average(jobs.map((job) => Number(job.queue_latency_ms || 0))),
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerId = crypto.randomUUID();
  const [briefing, audio] = await Promise.all([
    processJobsByType('briefing.generate', workerId),
    processJobsByType('audio.requested', workerId),
  ]);

  return NextResponse.json({
    ok: true,
    workerId,
    briefing,
    audio,
    claimed: briefing.claimed + audio.claimed,
    processed: briefing.processed + audio.processed,
    failed: briefing.failed + audio.failed,
    deadLettered: briefing.deadLettered + audio.deadLettered,
  });
}
