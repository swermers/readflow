import { createClient } from '@/utils/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const siteUrl = request.nextUrl.origin;
  const redirectTo = `${siteUrl}/auth/callback`;

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
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=Could not connect to Google`);
  }

  return NextResponse.redirect(data.url);
}
