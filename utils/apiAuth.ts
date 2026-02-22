import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

type AuthResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

/**
 * Authenticate the current request and return the Supabase client and user.
 * Returns null if authentication fails — caller should return the error response.
 */
export async function requireAuth(): Promise<
  | { ok: true; supabase: AuthResult['supabase']; user: AuthResult['user'] }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, supabase, user };
}

/**
 * Authenticate an admin/worker request via Bearer token.
 */
export function requireWorkerAuth(request: Request): boolean {
  const auth = request.headers.get('authorization');
  const expected = process.env.ADMIN_QUEUE_SECRET || process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}
