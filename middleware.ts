import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Some OAuth flows can land on /login?code=... instead of /auth/callback.
  // Forward those requests server-side so the code is always exchanged.
  if (pathname === '/login') {
    const code = request.nextUrl.searchParams.get('code');

    if (code) {
      const callbackUrl = request.nextUrl.clone();
      callbackUrl.pathname = '/auth/callback';
      callbackUrl.search = '';
      callbackUrl.searchParams.set('code', code);

      const next = request.nextUrl.searchParams.get('next');
      if (next?.startsWith('/')) {
        callbackUrl.searchParams.set('next', next);
      }

      return NextResponse.redirect(callbackUrl);
    }
  }

  // This refreshes the auth session on every request
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
