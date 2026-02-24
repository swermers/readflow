import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/account/disconnect-gmail
 * Clears Gmail tokens and sync labels from the user's profile.
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

  const { error } = await db
    .from('profiles')
    .update({
      gmail_connected: false,
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_token_expires_at: null,
      gmail_sync_labels: [],
      gmail_last_sync_at: null,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[Disconnect Gmail] Error:', error.message);
    return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}
