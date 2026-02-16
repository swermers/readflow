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
      console.log('[Auth Callback] user.app_metadata.provider:', user.app_metadata?.provider);
      console.log('[Auth Callback] user.app_metadata.providers:', user.app_metadata?.providers);

      // Check if user has a profile, create one if not.
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

      // Try to read gmail state separately — detect missing columns
      let gmailColumnsExist = true;
      let existingGmailState: { gmail_connected: boolean | null; gmail_refresh_token: string | null } | null = null;
      {
        const { data, error: gmailSelectErr } = await supabase
          .from('profiles')
          .select('gmail_connected, gmail_refresh_token')
          .eq('id', user.id)
          .single();
        if (gmailSelectErr && gmailSelectErr.message?.includes('schema cache')) {
          gmailColumnsExist = false;
          console.error('[Auth Callback] Gmail columns not found — run migration 002');
        } else if (data) {
          existingGmailState = data;
        }
      }

      // Save Gmail OAuth tokens
      let gmailConnected = false;
      let tokenSaveError: string | null = null;

      if (!gmailColumnsExist) {
        tokenSaveError =
          'Database migration required: the gmail token columns do not exist in the profiles table. ' +
          'Please run the SQL in supabase/migrations/002_add_gmail_tokens.sql against your Supabase project, ' +
          'then try connecting Gmail again.';
        console.error('[Auth Callback]', tokenSaveError);
      } else if (providerRefreshToken) {
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
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            gmail_access_token: providerToken,
            gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            gmail_connected: true,
          })
          .eq('id', user.id);

        if (updateErr) {
          console.error('[Auth Callback] Access token save failed:', updateErr);
          tokenSaveError = updateErr.message;
        } else {
          console.log('[Auth Callback] Access token saved (no refresh token — mark connected anyway)');
          gmailConnected = true;
        }
      } else {
        // Neither token present — this is the key diagnostic case
        console.warn('[Auth Callback] ⚠️ No provider tokens received from OAuth session.');
        console.warn('[Auth Callback] Session keys present:', Object.keys(data.session));
        console.warn('[Auth Callback] This typically means the Supabase Google provider');
        console.warn('  is missing the Client Secret, or is using "Sign in with Google"');
        console.warn('  instead of traditional OAuth 2.0.');

        // Check if the user previously connected (tokens already exist)
        if (existingGmailState?.gmail_connected && existingGmailState?.gmail_refresh_token) {
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
        if (gmailConnected) {
          return NextResponse.redirect(`${siteUrl}/settings?gmail=connected`);
        }
        // No tokens received — provide specific diagnostic info
        return NextResponse.redirect(
          `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(
            'No provider tokens received from Google. This means Supabase is not returning ' +
            'Google OAuth tokens. Please check: (1) In Supabase Dashboard > Auth > Providers > Google, ' +
            'make sure BOTH Client ID and Client Secret are filled in. (2) The Client Secret must come ' +
            'from Google Cloud Console > APIs & Services > Credentials > your OAuth 2.0 Client ID. ' +
            '(3) If you only see a "Client ID" field (no Secret), your Supabase Google provider ' +
            'may be configured for "Sign in with Google" instead of traditional OAuth — you need the latter for Gmail API access.'
          )}`
        );
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }

    console.error('[Auth Callback] Exchange error:', error);

    if (isGmailConnect) {
      const msg = error?.message || 'Code exchange failed';
      return NextResponse.redirect(
        `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(msg)}`
      );
    }
  }

  // Check for OAuth errors in query params
  const oauthError = searchParams.get('error');
  if (isGmailConnect && oauthError) {
    const errorDesc = searchParams.get('error_description') || oauthError;
    return NextResponse.redirect(
      `${siteUrl}/settings?gmail=error&gmail_error=${encodeURIComponent(errorDesc)}`
    );
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=LoginFailed`);
}
