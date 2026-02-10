import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // If "next" is present, use it; otherwise, go to the dashboard/home
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    
    // Exchange the code for a session. 
    // This will look for the PKCE verifier cookie set by the browser.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended page on the production domain
      return NextResponse.redirect(`https://readflow-inky.vercel.app${next}`);
    }
    
    console.error('Auth Callback Error:', error);
  }

  // If there's no code or an exchange error occurred
  return NextResponse.redirect(
  `https://readflow-inky.vercel.app/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
);
}