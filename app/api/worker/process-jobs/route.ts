export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { claimQueuedJobs, markJobComplete, markJobFailed } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateWeeklyBriefForUser } from '@/utils/weeklyBrief';
import { NextResponse } from 'next/server';

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const jobs = await claimQueuedJobs(supabase, 'briefing.generate', 25);

  let processed = 0;
  for (const job of jobs) {
    try {
      const userId = job.payload?.userId as string | undefined;
      if (!userId) throw new Error('Missing userId payload');
      await generateWeeklyBriefForUser(supabase, userId, true);
      await markJobComplete(supabase, job.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Job failed';
      await markJobFailed(supabase, job.id, Number(job.attempts || 0), message);
    }
  }

  return NextResponse.json({ ok: true, processed, claimed: jobs.length });
}
