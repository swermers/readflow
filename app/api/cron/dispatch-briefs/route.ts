export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/utils/supabase/admin';
import { enqueueJob } from '@/utils/jobs';
import { getRollingWindowRange } from '@/utils/weeklyBrief';
import { NextResponse } from 'next/server';

type ProfileSchedule = {
  user_id: string;
  brief_delivery_days: number[] | null;
  brief_delivery_hour: number | null;
  brief_delivery_tz: string | null;
  brief_last_enqueued_for_date: string | null;
};

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

function getLocalParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday || 'Mon'] ?? 1,
    hour: Number(parts.hour || '0'),
  };
}

function shouldEnqueue(profile: ProfileSchedule, now: Date) {
  const tz = profile.brief_delivery_tz || 'UTC';
  const days = (profile.brief_delivery_days && profile.brief_delivery_days.length ? profile.brief_delivery_days : [1]).map((d) =>
    Number(d),
  );
  const hour = Number(profile.brief_delivery_hour ?? 9);
  const local = getLocalParts(now, tz);

  if (!days.includes(local.weekday)) return { should: false, localDate: local.localDate };
  if (local.hour < hour) return { should: false, localDate: local.localDate };
  if (profile.brief_last_enqueued_for_date === local.localDate) return { should: false, localDate: local.localDate };

  return { should: true, localDate: local.localDate };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Step 1: Get user_ids of elite+active users from profile_billing
  const { data: billingUsers, error: billingError } = await supabase
    .from('profile_billing')
    .select('user_id')
    .eq('plan_tier', 'elite')
    .eq('plan_status', 'active');

  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });

  const eligibleUserIds = (billingUsers || []).map((b) => b.user_id);
  if (eligibleUserIds.length === 0) {
    return NextResponse.json({ ok: true, enqueued: 0 });
  }

  // Step 2: Get preferences for those users from profile_preferences
  const { data: users, error } = await supabase
    .from('profile_preferences')
    .select('user_id, brief_delivery_days, brief_delivery_hour, brief_delivery_tz, brief_last_enqueued_for_date')
    .in('user_id', eligibleUserIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enqueued = 0;
  for (const profile of (users || []) as ProfileSchedule[]) {
    const decision = shouldEnqueue(profile, now);
    if (!decision.should) continue;

    const { weekStartDate, weekEndDate } = getRollingWindowRange(7, now);
    const deliveryKey = `${decision.localDate}:${profile.user_id}`;

    await enqueueJob(
      supabase,
      'briefing.generate',
      { userId: profile.user_id, weekStartDate, weekEndDate, deliveryKey },
      `briefing:${profile.user_id}:${deliveryKey}`,
      { maxAttempts: 4 },
    );

    await enqueueJob(
      supabase,
      'podcast.weekly',
      { userId: profile.user_id, weekStartDate, weekEndDate, deliveryKey },
      `podcast:${profile.user_id}:${deliveryKey}`,
      { maxAttempts: 4 },
    );

    await supabase
      .from('profile_preferences')
      .update({ brief_last_enqueued_for_date: decision.localDate })
      .eq('user_id', profile.user_id);

    enqueued += 1;
  }

  return NextResponse.json({ ok: true, enqueued });
}
