import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/account/delete
 * Deletes all user data and resets the profile to a clean slate.
 * Uses admin client to bypass RLS (some tables lack DELETE policies).
 */
export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Delete all user data from child tables
    const results = await Promise.allSettled([
      db.from('highlights').delete().eq('user_id', user.id),
      db.from('user_issue_events').delete().eq('user_id', user.id),
      db.from('user_article_feedback').delete().eq('user_id', user.id),
      db.from('deleted_issues').delete().eq('user_id', user.id),
      db.from('issues').delete().eq('user_id', user.id),
      db.from('senders').delete().eq('user_id', user.id),
    ]);

    // Log any failures
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[Delete Account] Table ${i} delete failed:`, r.reason);
      } else if (r.value?.error) {
        console.error(`[Delete Account] Table ${i} delete error:`, r.value.error.message);
      }
    });

    // Reset profile to clean slate
    const { error: resetError } = await db
      .from('profiles')
      .update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expires_at: null,
        gmail_sync_labels: [],
        gmail_last_sync_at: null,
        ai_credits_used: 0,
        brief_delivery_days: null,
        brief_delivery_hour: null,
        brief_delivery_tz: null,
      })
      .eq('id', user.id);

    if (resetError) {
      console.error('[Delete Account] Profile reset error:', resetError.message);
      return NextResponse.json({ error: 'Failed to reset profile' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[Delete Account] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not fully delete data' }, { status: 500 });
  }
}
