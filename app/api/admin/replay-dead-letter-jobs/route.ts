export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { isJobType, replayDeadLetterJobs } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.ADMIN_QUEUE_SECRET || process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const type = typeof body?.type === 'string' ? body.type : '';
  const limitRaw = Number(body?.limit || 50);
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 120) : 'manual_replay';

  if (!isJobType(type)) {
    return NextResponse.json({ error: 'Invalid or missing job type' }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 50, 200));
  const supabase = createAdminClient();
  const result = await replayDeadLetterJobs({ supabase, type, limit, reason });

  return NextResponse.json({ ok: true, type, ...result });
}
