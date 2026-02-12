import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

function getRequestSiteUrl() {
  const headerStore = headers();
  const forwardedProto = headerStore.get('x-forwarded-proto') ?? 'https';
  const forwardedHost = headerStore.get('x-forwarded-host') ?? headerStore.get('host');

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function GET() {
  const supabase = await createClient();
  const redirectTo = `${getRequestSiteUrl()}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      `${getRequestSiteUrl()}/auth/auth-code-error?error=Could not connect to Google`
    );
  }

  return NextResponse.redirect(data.url);
}
