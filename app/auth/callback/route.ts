import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  // The `request.url` contains the code sent by Supabase
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // If there is a 'next' param, we will redirect there; otherwise, go to home (/)
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = cookies();
    
    // Create a Supabase client that can manage cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Success! Redirect the user to the dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, send them to an error page (or back to login)
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}