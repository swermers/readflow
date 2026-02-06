import { type NextRequest, NextResponse } from 'next/server'; // Import NextResponse
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // return await updateSession(request); <--- COMMENT THIS OUT
  return NextResponse.next(); // <--- ADD THIS (Let everyone in!)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};