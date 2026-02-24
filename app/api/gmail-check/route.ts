import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { refreshAccessToken } from '@/utils/gmailClient';

/**
 * GET /api/gmail-check
 * Self-healing endpoint: checks if the user has valid Gmail tokens stored
 * and fixes gmail_connected if tokens are still valid.
 * Called by the settings page when gmail_connected is false to avoid
 * forcing the user through a second OAuth flow.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  // Use admin client for writes to bypass RLS timing issues
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    // fallback below
  }
  const db = admin || supabase;

  const { data: profile } = await db
    .from('profiles')
    .select('gmail_refresh_token, gmail_connected')
    .eq('id', user.id)
    .single();

  // No refresh token stored — genuinely disconnected
  if (!profile?.gmail_refresh_token) {
    return NextResponse.json({ connected: false, reason: 'no_token' });
  }

  // Already marked connected — nothing to fix
  if (profile.gmail_connected) {
    return NextResponse.json({ connected: true });
  }

  // Has a refresh token but gmail_connected is false — try to verify and fix
  try {
    const { accessToken, expiresAt } = await refreshAccessToken(profile.gmail_refresh_token);

    // Token is valid — fix the flag and update the access token
    await db
      .from('profiles')
      .update({
        gmail_connected: true,
        gmail_access_token: accessToken,
        gmail_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({ connected: true, restored: true });
  } catch (err: any) {
    const msg = err.message || '';

    // Token permanently revoked — clear everything
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      await db
        .from('profiles')
        .update({
          gmail_connected: false,
          gmail_access_token: null,
          gmail_refresh_token: null,
        })
        .eq('id', user.id);

      return NextResponse.json({ connected: false, reason: 'revoked' });
    }

    // Transient failure — don't clear tokens, but can't confirm connection
    return NextResponse.json({ connected: false, reason: 'transient', canRetry: true });
  }
}
