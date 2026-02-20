export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { checkEntitlement, format402Payload } from '@/utils/aiEntitlements';
import { NextRequest, NextResponse } from 'next/server';

type PodcastRow = {
  status: string;
  mime_type: string | null;
  audio_base64: string | null;
  created_at: string;
  delivery_key: string | null;
  week_start: string | null;
  week_end: string | null;
};

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
    .select('status, mime_type, audio_base64, created_at, delivery_key, week_start, week_end')
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
          deliveryKey: row.delivery_key,
          weekStart: row.week_start,
          weekEnd: row.week_end,
        }
      : null,
  });
}
