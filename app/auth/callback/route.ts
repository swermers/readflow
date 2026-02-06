import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // The URL contains a code (like a ticket)
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    // Exchange the code for a session (cookie)
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Send the user to the dashboard
  return NextResponse.redirect(requestUrl.origin);
}