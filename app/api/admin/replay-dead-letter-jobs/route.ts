export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set(['briefing.generate', 'audio.requested', 'notion.sync']);

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.ADMIN_QUEUE_SECRET || process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { type?: string; limit?: number };
  const type = body.type || 'notion.sync';
  const limit = Math.min(Math.max(Number(body.limit || 50), 1), 500);

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: jobs, error } = await supabase
    .from('background_jobs')
    .select('id')
    .eq('type', type)
    .eq('status', 'dead_letter')
    .order('dead_lettered_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (jobs || []).map((j) => j.id);
  if (!ids.length) return NextResponse.json({ ok: true, replayed: 0 });

  const { error: updateError } = await supabase
    .from('background_jobs')
    .update({
      status: 'queued',
      retry_at: new Date().toISOString(),
      dead_lettered_at: null,
      last_error: null,
      locked_by: null,
      locked_at: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, replayed: ids.length, type });
}
