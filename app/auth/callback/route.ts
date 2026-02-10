import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    // 1. Create a response object first, so we can attach cookies to it later
    // We redirect to the 'next' path (usually / or /dashboard)
    const response = NextResponse.redirect(`${origin}${next}`);

    // 2. Create the Supabase client manually for this Route Handler
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // The critical part: READ cookies directly from the incoming Request
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          // WRITE cookies to the outgoing Response
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.delete({
              name,
              ...options,
            });
          },
        },
      }
    );

    // 3. Exchange the code. Supabase will look in `request.cookies` for the verifier
    // and write the session to `response.cookies`.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If successful, return the response we created (which now contains the session cookie)
      return response;
    }

    // If exchange fails, redirect to error page
    console.error('Auth Callback Error:', error);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  // If no code found
  return NextResponse.redirect(
    `${origin}/auth/auth-code-error?error=${encodeURIComponent('No authentication code provided')}`
  );
}