import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/account/delete
 * Deletes all user data and resets the profile to a clean slate.
 * Uses admin client to bypass RLS (some tables lack DELETE policies).
 * Accepts GET and POST as well — some infrastructure layers block certain methods.
 */
export async function GET() {
  return handleDelete();
}

export async function POST() {
  return handleDelete();
}

async function handleDelete() {
  let supabase;
  try {
    supabase = await createClient();
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr);
    console.error('[Delete Account] createClient() threw:', msg);
    return NextResponse.json(
      { error: 'Server initialization failed', debug: { phase: 'createClient', message: msg } },
      { status: 500 }
    );
  }

  let user;
  try {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', debug: { phase: 'auth', message: authError?.message || 'no user' } },
        { status: 401 }
      );
    }
    user = data.user;
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    console.error('[Delete Account] auth.getUser() threw:', msg);
    return NextResponse.json(
      { error: 'Authentication error', debug: { phase: 'auth', message: msg } },
      { status: 500 }
    );
  }

  // Use admin client for DB writes to bypass RLS; fall back to server client
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    console.warn('[Delete Account] Admin client unavailable, falling back to server client');
    db = supabase as any;
  }

  try {
    // Delete child tables first (order matters for foreign keys)
    const childTables = ['highlights', 'user_issue_events', 'user_article_feedback', 'deleted_issues'];
    for (const table of childTables) {
      const { error } = await db.from(table).delete().eq('user_id', user.id);
      if (error) {
        console.warn(`[Delete Account] ${table} delete error (continuing):`, error.message);
      }
    }

    // Then delete issues, then senders (issues references senders)
    const { error: issuesErr } = await db.from('issues').delete().eq('user_id', user.id);
    if (issuesErr) console.warn('[Delete Account] issues delete error:', issuesErr.message);

    const { error: sendersErr } = await db.from('senders').delete().eq('user_id', user.id);
    if (sendersErr) console.warn('[Delete Account] senders delete error:', sendersErr.message);

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
        brief_delivery_days: [1],
        brief_delivery_hour: 9,
        brief_delivery_tz: 'UTC',
      })
      .eq('id', user.id);

    if (resetError) {
      console.error('[Delete Account] Profile reset error:', resetError.message);
      return NextResponse.json(
        { error: 'Failed to reset profile', debug: { phase: 'profileReset', message: resetError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Delete Account] Unexpected error:', msg);
    return NextResponse.json(
      { error: 'Could not fully delete data', debug: { phase: 'deleteOps', message: msg } },
      { status: 500 }
    );
  }
}
