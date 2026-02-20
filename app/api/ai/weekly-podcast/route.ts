export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkEntitlement, format402Payload } from '@/utils/aiEntitlements';
import { enqueueJob } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type PodcastRow = {
  status: string;
  mime_type: string | null;
  audio_base64: string | null;
  created_at: string;
  updated_at: string;
  last_error: string | null;
  delivery_key: string | null;
  week_start: string | null;
  week_end: string | null;
};

type BriefWindow = {
  delivery_key: string | null;
  week_start: string;
  week_end: string;
};

async function getLatestBriefWindow(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<BriefWindow | null> {
  const { data } = await supabase
    .from('weekly_briefs')
    .select('delivery_key, week_start, week_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.week_start || !data?.week_end) return null;
  return data as BriefWindow;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entitlement = await checkEntitlement(supabase, user.id, 'weekly_brief');
  if (!entitlement.allowed) return NextResponse.json(format402Payload(entitlement), { status: 402 });

  const deliveryKey = request.nextUrl.searchParams.get('deliveryKey');
  const weekStart = request.nextUrl.searchParams.get('weekStart');
  const weekEnd = request.nextUrl.searchParams.get('weekEnd');

  let query = supabase
    .from('weekly_podcast_cache')
    .select('status, mime_type, audio_base64, created_at, updated_at, last_error, delivery_key, week_start, week_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (deliveryKey) {
    query = query.eq('delivery_key', deliveryKey);
  } else if (weekStart && weekEnd) {
    query = query.eq('week_start', weekStart).eq('week_end', weekEnd);
  }

  const { data } = await query.maybeSingle();
  const row = (data || null) as PodcastRow | null;

  return NextResponse.json({
    podcast: row
      ? {
          status: row.status,
          mimeType: row.mime_type,
          audioBase64: row.audio_base64,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastError: row.last_error,
          deliveryKey: row.delivery_key,
          weekStart: row.week_start,
          weekEnd: row.week_end,
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entitlement = await checkEntitlement(supabase, user.id, 'weekly_brief');
  if (!entitlement.allowed) return NextResponse.json(format402Payload(entitlement), { status: 402 });

  const body = (await request.json().catch(() => ({}))) as {
    deliveryKey?: string;
    weekStart?: string;
    weekEnd?: string;
  };

  let deliveryKey = body.deliveryKey || null;
  let weekStart = body.weekStart || null;
  let weekEnd = body.weekEnd || null;

  if (!weekStart || !weekEnd) {
    const latest = await getLatestBriefWindow(supabase, user.id);
    if (!latest) {
      return NextResponse.json({ error: 'Generate a weekly brief first before requesting podcast audio.' }, { status: 400 });
    }
    deliveryKey = deliveryKey || latest.delivery_key || null;
    weekStart = latest.week_start;
    weekEnd = latest.week_end;
  }

  const admin = createAdminClient();

  await admin.from('weekly_podcast_cache').upsert(
    {
      user_id: user.id,
      delivery_key: deliveryKey,
      week_start: weekStart,
      week_end: weekEnd,
      status: 'queued',
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,delivery_key' },
  );

  const dedupeKey = deliveryKey
    ? `podcast:${user.id}:${deliveryKey}`
    : `podcast:${user.id}:${weekStart}:${weekEnd}`;

  await enqueueJob(
    admin,
    'podcast.weekly',
    { userId: user.id, deliveryKey, weekStartDate: weekStart, weekEndDate: weekEnd },
    dedupeKey,
    { maxAttempts: 4 },
  );

  return NextResponse.json({ status: 'queued', deliveryKey, weekStart, weekEnd }, { status: 202 });
}
