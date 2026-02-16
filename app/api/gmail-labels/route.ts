import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listLabels } from '@/utils/gmailClient';

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

    if (err.message?.includes('Token refresh failed')) {
      await supabase
        .from('profiles')
        .update({ gmail_connected: false, gmail_access_token: null, gmail_refresh_token: null })
        .eq('id', user.id);
      return NextResponse.json({ error: 'Gmail token expired. Please sign in again.' }, { status: 401 });
    }

    return NextResponse.json({ error: err.message || 'Failed to fetch labels' }, { status: 500 });
  }
}
