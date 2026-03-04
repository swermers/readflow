import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

function generateAlias(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as
    | 'signup'
    | 'magiclink'
    | 'recovery'
    | 'email'
    | null;
  const next = searchParams.get('next') ?? '/';

  const requestUrl = new URL(request.url);
  const originFromRequest = requestUrl.origin;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? originFromRequest;

  // Handle magic link, email signup confirmation, and password recovery tokens
  if (token_hash && type) {
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      console.error('[Auth Callback] OTP verify error:', error);
      return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
    }

    if (data.session) {
      const user = data.session.user;

      // Ensure profile exists for new magic link / email signup users
      let admin: ReturnType<typeof createAdminClient> | null = null;
      try {
        admin = createAdminClient();
      } catch {
        console.warn('[Auth Callback] Admin client unavailable, falling back to anon client');
      }
      const db = admin || supabase;

      const { data: existing } = await db
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        const { error: insertErr } = await db.from('profiles').insert({
          id: user.id,
          email: user.email,
          forwarding_alias: generateAlias(),
        });
        if (insertErr) {
          console.error('[Auth Callback] Profile insert failed:', insertErr);
        }
      }
    }

    // Password recovery → redirect to update-password page
    if (type === 'recovery') {
      return NextResponse.redirect(`${siteUrl}/auth/update-password`);
    }

    return NextResponse.redirect(`${siteUrl}${next}`);
  }

  if (code) {
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;

      console.log('[Auth Callback] Session established for user:', user.id);
      console.log('[Auth Callback] provider_token present:', !!providerToken);
      console.log('[Auth Callback] provider_refresh_token present:', !!providerRefreshToken);

      // Use admin client to bypass RLS for profile operations
      // The anon client can fail due to auth context timing during callback
      let admin: ReturnType<typeof createAdminClient> | null = null;
      try {
        admin = createAdminClient();
      } catch {
        console.warn('[Auth Callback] Admin client unavailable, falling back to anon client');
      }
      const db = admin || supabase;

      // Ensure profile exists
      const { data: existing } = await db
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        const { error: insertErr } = await db.from('profiles').insert({
          id: user.id,
          email: user.email,
          forwarding_alias: generateAlias(),
        });
        if (insertErr) {
          console.error('[Auth Callback] Profile insert failed:', insertErr);
        }
      }

      // Always try to save Gmail tokens when present (login or re-auth)
      let gmailConnected = false;
      let tokenSaveError: string | null = null;

      if (providerToken || providerRefreshToken) {
        const updates: Record<string, unknown> = {
          gmail_connected: true,
        };

        if (providerToken) {
          updates.gmail_access_token = providerToken;
          updates.gmail_token_expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
        }
        if (providerRefreshToken) {
          updates.gmail_refresh_token = providerRefreshToken;
        }

        const { error: updateErr } = await db
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (updateErr) {
          console.error('[Auth Callback] Token save failed:', updateErr);
          tokenSaveError = updateErr.message;
        } else {
          console.log('[Auth Callback] Gmail tokens saved successfully');
          gmailConnected = true;
        }
      } else {
        // No provider tokens — normal for email/password and magic link users
        console.log('[Auth Callback] No provider tokens (email/password or magic link login).');
      }

      // If redirecting to /settings (e.g. Gmail re-auth), include result info
      if (next.startsWith('/settings')) {
        if (tokenSaveError) {
          return NextResponse.redirect(
            `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(tokenSaveError)}`
          );
        }
        if (gmailConnected) {
          return NextResponse.redirect(`${siteUrl}/settings?gmail=connected`);
        }
        // No tokens but came from settings — user may have been trying to connect Gmail
        return NextResponse.redirect(`${siteUrl}/settings`);
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }

    console.error('[Auth Callback] Exchange error:', error);

    if (next.startsWith('/settings')) {
      const msg = error?.message || 'Code exchange failed';
      return NextResponse.redirect(
        `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(msg)}`
      );
    }
  }

  // Check for OAuth errors in query params
  const oauthError = searchParams.get('error');
  if (oauthError && next.startsWith('/settings')) {
    const errorDesc = searchParams.get('error_description') || oauthError;
    return NextResponse.redirect(
      `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(errorDesc)}`
    );
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=LoginFailed`);
}
