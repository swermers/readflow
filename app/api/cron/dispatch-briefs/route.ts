export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/utils/supabase/admin';
import { enqueueJob } from '@/utils/jobs';
import { getLastCompletedWeekRange } from '@/utils/weeklyBrief';
import { NextResponse } from 'next/server';

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { weekStartDate } = getLastCompletedWeekRange();

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('plan_tier', 'elite')
    .eq('plan_status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enqueued = 0;
  for (const profile of users || []) {
    await enqueueJob({
      supabase,
      type: 'briefing.generate',
      payload: { userId: profile.id, weekStartDate },
      dedupeKey: `briefing:${profile.id}:${weekStartDate}`,
      maxAttempts: 4,
    });
    enqueued += 1;
  }

  return NextResponse.json({ ok: true, enqueued });
}
