export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { countJobs, type JobType } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

const JOB_TYPES: JobType[] = ['briefing.generate', 'audio.requested', 'notion.sync'];

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.ADMIN_QUEUE_SECRET || process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const counts = await Promise.all(JOB_TYPES.map((type) => countJobs(supabase, type, 'dead_letter')));

  return NextResponse.json({
    ok: true,
    deadLetter: {
      'briefing.generate': counts[0],
      'audio.requested': counts[1],
      'notion.sync': counts[2],
      total: counts.reduce((sum, value) => sum + value, 0),
    },
  });
}
