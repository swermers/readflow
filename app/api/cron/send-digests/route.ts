export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/utils/supabase/admin';
import { gatherDigestData, buildDigestHtml } from '@/utils/emailDigest';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

/**
 * Cron endpoint: send weekly email digests to Pro+ users.
 * Intended to be called by a cron job every Monday morning (e.g., 9am UTC).
 *
 * Checks each eligible user's timezone and preferred delivery hour
 * before sending, so it can safely be called multiple times per day.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const supabase = createAdminClient();
  const now = new Date();

  // Step 1: Get user_ids of pro/elite active users from profile_billing
  const { data: billingUsers, error: billingError } = await supabase
    .from('profile_billing')
    .select('user_id, plan_tier')
    .in('plan_tier', ['pro', 'elite'])
    .eq('plan_status', 'active');

  if (billingError) {
    return NextResponse.json({ error: billingError.message }, { status: 500 });
  }

  const eligibleUserIds = (billingUsers || []).map((b) => b.user_id);
  if (eligibleUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // Step 2: Batch-fetch profiles (email, full_name) for eligible users
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', eligibleUserIds);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Step 3: Batch-fetch preferences (digest fields) for eligible users
  const { data: prefRows, error: prefError } = await supabase
    .from('profile_preferences')
    .select('user_id, digest_enabled, digest_day, digest_hour, digest_tz, digest_last_sent_date')
    .in('user_id', eligibleUserIds)
    .neq('digest_enabled', false);

  if (prefError) {
    return NextResponse.json({ error: prefError.message }, { status: 500 });
  }

  // Build lookup maps
  const billingMap = new Map((billingUsers || []).map((b) => [b.user_id, b]));
  const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));

  // Combine into a unified users list (only users who have preferences with digest not disabled)
  const users = (prefRows || []).map((pref) => {
    const profile = profileMap.get(pref.user_id);
    const billing = billingMap.get(pref.user_id);
    return {
      id: pref.user_id,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      plan_tier: billing?.plan_tier ?? null,
      digest_enabled: pref.digest_enabled,
      digest_day: pref.digest_day,
      digest_hour: pref.digest_hour,
      digest_tz: pref.digest_tz,
      digest_last_sent_date: pref.digest_last_sent_date,
    };
  });

  let sent = 0;
  let skipped = 0;

  for (const user of users || []) {
    try {
      // Check if it's the right day and hour in the user's timezone
      const tz = user.digest_tz || 'America/New_York';
      const preferredDay = user.digest_day ?? 1; // 1 = Monday
      const preferredHour = user.digest_hour ?? 9;

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
      });

      const parts = Object.fromEntries(
        formatter.formatToParts(now).map((part) => [part.type, part.value]),
      );

      const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };
      const localDay = weekdayMap[parts.weekday || 'Mon'] ?? 1;
      const localHour = Number(parts.hour || '0');
      const localDate = `${parts.year}-${parts.month}-${parts.day}`;

      // Only send on the preferred day, after the preferred hour, and not already sent today
      if (localDay !== preferredDay || localHour < preferredHour) {
        skipped++;
        continue;
      }

      if (user.digest_last_sent_date === localDate) {
        skipped++;
        continue;
      }

      if (!user.email) {
        skipped++;
        continue;
      }

      // Gather digest content
      const digestData = await gatherDigestData(supabase, user.id);
      if (!digestData) {
        skipped++;
        continue;
      }

      const html = buildDigestHtml(digestData);
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'digest@readflow.app';

      await resend.emails.send({
        from: `Readflow <${fromAddress}>`,
        to: user.email,
        subject: `Your Weekly Digest — ${digestData.issues.length} issue${digestData.issues.length === 1 ? '' : 's'} this week`,
        html,
      });

      // Mark as sent for today
      await supabase
        .from('profile_preferences')
        .update({ digest_last_sent_date: localDate })
        .eq('user_id', user.id);

      sent++;
    } catch (err) {
      console.error(`Digest send failed for user ${user.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
