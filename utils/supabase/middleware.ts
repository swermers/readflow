import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Check User
  const { data: { user }, error } = await supabase.auth.getUser();

  // --- DEBUGGING LOGS (Check Vercel Function Logs) ---
  console.log("Middleware Run:");
  console.log("Path:", request.nextUrl.pathname);
  console.log("Cookie Found?", request.cookies.getAll().some(c => c.name.startsWith('sb-')));
  console.log("User Found?", !!user);
  if (error) console.log("Supabase Error:", error.message);
  // ---------------------------------------------------

  // 2. Protected Routes
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
    console.log("Redirecting to /login"); // Log the redirect
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 3. Login Page Redirect
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    console.log("Redirecting to /"); // Log the redirect
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}