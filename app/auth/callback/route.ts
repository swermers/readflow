import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // FORCE HTTPS: Hardcode your production URL to prevent protocol mismatches
  const siteUrl = 'https://readflow-inky.vercel.app';

  if (code) {
    // Create the redirect response using the HARDCODED https URL
    const response = NextResponse.redirect(`${siteUrl}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Force the cookie to be Secure and properly scoped
            response.cookies.set({
              name,
              value,
              ...options,
              sameSite: 'lax',
              secure: true, // Force Secure on production
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
    
    // Log error and redirect to error page
    console.error('Auth Exchange Error:', error);
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?error=NoCode`);
}