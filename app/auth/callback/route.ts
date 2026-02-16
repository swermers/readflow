import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
  const next = searchParams.get('next') ?? '/';

  const requestUrl = new URL(request.url);
  const originFromRequest = requestUrl.origin;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? originFromRequest;

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

      // Ensure profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        const { error: insertErr } = await supabase.from('profiles').insert({
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

      // Check if gmail columns exist
      let gmailColumnsExist = true;
      {
        const { error: gmailSelectErr } = await supabase
          .from('profiles')
          .select('gmail_connected')
          .eq('id', user.id)
          .single();
        if (gmailSelectErr && gmailSelectErr.message?.includes('schema cache')) {
          gmailColumnsExist = false;
          console.error('[Auth Callback] Gmail columns not found — run migration 002');
        }
      }

      if (gmailColumnsExist && (providerToken || providerRefreshToken)) {
        const updates: Record<string, any> = {
          gmail_connected: true,
        };

        if (providerToken) {
          updates.gmail_access_token = providerToken;
          updates.gmail_token_expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
        }
        if (providerRefreshToken) {
          updates.gmail_refresh_token = providerRefreshToken;
        }

        const { error: updateErr } = await supabase
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
      } else if (gmailColumnsExist && !providerToken && !providerRefreshToken) {
        console.warn('[Auth Callback] No provider tokens received from OAuth session.');
        console.warn('[Auth Callback] Check: Supabase Google provider has Client ID AND Client Secret');
      }

      // If redirecting to /settings, include result info
      if (next.startsWith('/settings')) {
        if (tokenSaveError) {
          return NextResponse.redirect(
            `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(tokenSaveError)}`
          );
        }
        if (gmailConnected) {
          return NextResponse.redirect(`${siteUrl}/settings?gmail=connected`);
        }
        if (!gmailColumnsExist) {
          return NextResponse.redirect(
            `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(
              'Database migration required: run supabase/migrations/002_add_gmail_tokens.sql'
            )}`
          );
        }
        if (!providerToken && !providerRefreshToken) {
          return NextResponse.redirect(
            `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(
              'No provider tokens received. Check that your Supabase Google provider has both Client ID AND Client Secret configured.'
            )}`
          );
        }
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
