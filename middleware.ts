import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Do not run session-refresh middleware on auth callback routes.
  // It can interfere with OAuth PKCE cookies while the code exchange is in progress.
  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
