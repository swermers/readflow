import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // 1. Setup the response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 🛑 HARDCODE YOUR CREDENTIALS HERE FOR DEBUGGING 🛑
  // (We do this to rule out Vercel Env Var issues completely)
  const SUPABASE_URL = "https://oqyarxdnfzdwjwbkfhvl.supabase.co"; // Paste your FULL URL here
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // Paste your FULL Anon Key here

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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

  // 2. Try to get the user
  const { data: { user }, error } = await supabase.auth.getUser();

  // 3. X-RAY LOGGING (Check Vercel Logs)
  console.log("--- MIDDLEWARE DEBUG ---");
  // Calculate what the cookie name SHOULD be
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
  const expectedCookieName = `sb-${projectRef}-auth-token`;
  
  console.log("Expected Cookie Name:", expectedCookieName);
  console.log("Actual Cookies Present:", request.cookies.getAll().map(c => c.name));
  
  const hasMatchingCookie = request.cookies.getAll().some(c => c.name === expectedCookieName);
  console.log("Has Matching Cookie?", hasMatchingCookie);
  console.log("User Authenticated?", !!user);
  if (error) console.log("Auth Error:", error.message);
  console.log("------------------------");

  // 🛑 DISABLE ALL REDIRECTS 🛑
  // We want to land on the page to see the logs, even if it looks broken.
  return response;
}