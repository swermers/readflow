import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/account/delete
 * Permanently deletes the user's auth account.
 * All data cascades via ON DELETE CASCADE (auth.users → profiles → issues, senders, etc.)
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

  // Admin client is required to delete auth users
  let adminDb;
  try {
    adminDb = createAdminClient();
  } catch {
    console.error('[Delete Account] Admin client unavailable — cannot delete auth user');
    return NextResponse.json(
      { error: 'Account deletion requires server admin access. Please contact support.', debug: { phase: 'adminClient' } },
      { status: 500 }
    );
  }

  try {
    console.log(`[Delete Account] Deleting user=${user.id} email=${user.email}`);

    // Delete the auth user — ON DELETE CASCADE handles everything:
    // auth.users → profiles → issues, senders, highlights, etc.
    const { error: deleteError } = await adminDb.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[Delete Account] auth.admin.deleteUser failed:', deleteError.message);
      return NextResponse.json(
        { error: 'Could not delete account. Please try again.', debug: { phase: 'deleteUser', message: deleteError.message } },
        { status: 500 }
      );
    }

    console.log(`[Delete Account] Successfully deleted user=${user.id}`);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Delete Account] Unexpected error:', msg);
    return NextResponse.json(
      { error: 'Could not delete account', debug: { phase: 'deleteUser', message: msg } },
      { status: 500 }
    );
  }
}
