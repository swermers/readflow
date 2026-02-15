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

      // Check if user has a profile, create one if not
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          forwarding_alias: generateAlias(),
        });
      }

      // Save Gmail OAuth tokens if present (means user granted gmail.readonly scope)
      if (providerRefreshToken) {
        await supabase
          .from('profiles')
          .update({
            gmail_access_token: providerToken || null,
            gmail_refresh_token: providerRefreshToken,
            gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            gmail_connected: true,
          })
          .eq('id', user.id);
      } else if (providerToken) {
        // Got an access token but no refresh token — update what we can
        // This happens on subsequent logins when the refresh token was already granted
        await supabase
          .from('profiles')
          .update({
            gmail_access_token: providerToken,
            gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          })
          .eq('id', user.id);
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }

    console.error('Exchange Error:', error);
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=LoginFailed`);
}
