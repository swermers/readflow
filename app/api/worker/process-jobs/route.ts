export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { claimQueuedJobs, markJobComplete, markJobFailed } from '@/utils/jobs';
import { processAudioRequestedJob } from '@/utils/audioJob';
import { createAdminClient } from '@/utils/supabase/admin';
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

async function processBriefingJobs(workerId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const jobs = await claimQueuedJobs(supabase, 'briefing.generate', workerId, 25, 240);

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      const userId = job.payload?.userId as string | undefined;
      if (!userId) throw new Error('Missing userId payload');
      await generateWeeklyBriefForUser(supabase, userId, true);
      await markJobComplete(supabase, job.id, workerId);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Job failed';
      await markJobFailed(supabase, job, workerId, message);
      failed += 1;
      if (Number(job.attempts || 0) + 1 >= Number(job.max_attempts || 5)) {
        deadLettered += 1;
      }
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

async function processAudioJobs(workerId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const jobs = await claimQueuedJobs(supabase, 'audio.requested', workerId, 25, 240);

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      const userId = job.payload?.userId as string | undefined;
      const issueId = job.payload?.issueId as string | undefined;
      if (!userId || !issueId) throw new Error('Missing userId or issueId payload');
      await processAudioRequestedJob(supabase, userId, issueId);
      await markJobComplete(supabase, job.id, workerId);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Job failed';
      await markJobFailed(supabase, job, workerId, message);
      failed += 1;
      if (Number(job.attempts || 0) + 1 >= Number(job.max_attempts || 5)) {
        deadLettered += 1;
      }
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
  const [briefing, audio] = await Promise.all([processBriefingJobs(workerId), processAudioJobs(workerId)]);

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
