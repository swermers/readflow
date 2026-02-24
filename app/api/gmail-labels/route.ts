import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listLabels } from '@/utils/gmailClient';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — safe to ignore
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_refresh_token, gmail_connected')
    .eq('id', user.id)
    .single();

  if (!profile?.gmail_refresh_token) {
    return NextResponse.json({ error: 'Gmail not connected', labels: [] }, { status: 400 });
  }

  try {
    const { accessToken, expiresAt } = await refreshAccessToken(profile.gmail_refresh_token);

    // Update stored access token
    await supabase
      .from('profiles')
      .update({
        gmail_access_token: accessToken,
        gmail_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    const allLabels = await listLabels(accessToken);

    // Return user labels (custom labels created by the user)
    // plus a few useful system labels, sorted alphabetically
    const USEFUL_SYSTEM_LABELS = new Set(['INBOX', 'STARRED', 'IMPORTANT']);
    const labels = allLabels
      .filter(l => l.type === 'user' || USEFUL_SYSTEM_LABELS.has(l.id))
      .sort((a, b) => {
        // User labels first, then system labels
        if (a.type !== b.type) return a.type === 'user' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ labels });
  } catch (err: any) {
    console.error('Gmail labels error:', err);
    const msg = err.message || '';

    // Only clear tokens if Google explicitly rejected the refresh token
    // (invalid_grant means token was revoked or expired permanently)
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      await supabase
        .from('profiles')
        .update({ gmail_connected: false, gmail_access_token: null, gmail_refresh_token: null })
        .eq('id', user.id);
      return NextResponse.json(
        { error: 'Gmail access was revoked. Please reconnect Gmail.', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    // For other token refresh failures (network, temporary Google errors), don't nuke tokens
    if (msg.includes('Token refresh failed')) {
      return NextResponse.json(
        { error: 'Could not reach Gmail. Please try again in a moment.', code: 'REFRESH_FAILED' },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: msg || 'Failed to fetch labels' }, { status: 500 });
  }
}

/**
 * POST /api/gmail-labels — save selected label IDs to the user's profile.
 * Uses admin client to bypass RLS (same pattern as auth callback).
 */
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // safe to ignore
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { labels?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!Array.isArray(body.labels)) {
    return NextResponse.json({ error: 'labels must be an array' }, { status: 400 });
  }

  // Use admin client to bypass RLS
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    // fallback to anon client
    db = supabase as any;
  }

  const { error } = await db
    .from('profiles')
    .update({ gmail_sync_labels: body.labels })
    .eq('id', user.id);

  if (error) {
    console.error('[Gmail Labels] Save failed:', error);
    return NextResponse.json({ error: 'Failed to save labels' }, { status: 500 });
  }

  return NextResponse.json({ saved: true, count: body.labels.length });
}
