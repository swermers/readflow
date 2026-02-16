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

  // Detect whether this callback originated from a Gmail connection attempt
  // (i.e. user clicked "Connect Gmail" on /settings which redirects with next=/settings)
  const isGmailConnect = next.startsWith('/settings');

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
      console.log('[Auth Callback] isGmailConnect:', isGmailConnect);

      // Check if user has a profile, create one if not
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, gmail_connected, gmail_refresh_token')
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

      // Save Gmail OAuth tokens if present (means user granted gmail.readonly scope)
      let gmailConnected = false;
      let tokenSaveError: string | null = null;

      if (providerRefreshToken) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: providerToken || null,
            gmail_refresh_token: providerRefreshToken,
            gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            gmail_connected: true,
          })
          .eq('id', user.id);

        if (updateErr) {
          console.error('[Auth Callback] Token save failed:', updateErr);
          tokenSaveError = updateErr.message;
        } else {
          console.log('[Auth Callback] Gmail tokens saved successfully (with refresh token)');
          gmailConnected = true;
        }
      } else if (providerToken) {
        // Got an access token but no refresh token — update what we can
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: providerToken,
            gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          })
          .eq('id', user.id);

        if (updateErr) {
          console.error('[Auth Callback] Access token save failed:', updateErr);
          tokenSaveError = updateErr.message;
        } else {
          console.log('[Auth Callback] Access token saved (no refresh token this time)');
        }

        // Check if user already had a refresh token stored (from a previous grant)
        if (existing?.gmail_refresh_token) {
          gmailConnected = true;
        }
      } else {
        // Neither token present — this is the sign-in loop cause
        console.warn('[Auth Callback] No provider tokens received from OAuth session.');
        console.warn('[Auth Callback] This usually means:');
        console.warn('  1. Gmail API is not enabled in Google Cloud Console');
        console.warn('  2. gmail.readonly scope is not on the OAuth consent screen');
        console.warn('  3. The Supabase Google provider is not configured to return provider tokens');

        // Check if the user previously connected (tokens already exist)
        if (existing?.gmail_connected && existing?.gmail_refresh_token) {
          gmailConnected = true;
        }
      }

      // When redirecting back to /settings, include Gmail connection result
      if (isGmailConnect) {
        if (tokenSaveError) {
          return NextResponse.redirect(
            `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent('Token save failed: ' + tokenSaveError)}`
          );
        }
        const status = gmailConnected ? 'connected' : 'no_tokens';
        return NextResponse.redirect(`${siteUrl}/settings?gmail=${status}`);
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }

    console.error('[Auth Callback] Exchange error:', error);

    // If the exchange failed during a Gmail connection attempt, redirect back
    // to settings with an error instead of showing the generic error page
    if (isGmailConnect) {
      const msg = error?.message || 'Code exchange failed';
      return NextResponse.redirect(
        `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(msg)}`
      );
    }
  }

  // Check for OAuth errors in query params (e.g. Google denied the scope)
  const oauthError = searchParams.get('error');
  if (isGmailConnect && oauthError) {
    const errorDesc = searchParams.get('error_description') || oauthError;
    return NextResponse.redirect(
      `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(errorDesc)}`
    );
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=LoginFailed`);
}
