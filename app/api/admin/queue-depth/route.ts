export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/utils/supabase/admin';

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('type, status')
    .eq('status', 'queued');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queueDepth = (data ?? []).reduce<Record<string, number>>((acc, job) => {
    const type = typeof job.type === 'string' ? job.type : 'unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ ok: true, queueDepth });
}
