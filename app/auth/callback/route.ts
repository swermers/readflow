import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`https://readflow-inky.vercel.app${next}`);
    }

    // If the exchange failed, 'error' is available here
    console.error('Auth Callback Error:', error);
    return NextResponse.redirect(
      `https://readflow-inky.vercel.app/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  // If we reach this point, it means no 'code' was present in the URL at all
  return NextResponse.redirect(
    `https://readflow-inky.vercel.app/auth/auth-code-error?error=${encodeURIComponent('No authentication code provided')}`
  );
}