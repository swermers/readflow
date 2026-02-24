import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

/** Allowlist of profile columns that can be updated from the client. */
const ALLOWED_FIELDS = new Set([
  'first_name',
  'last_name',
  'brief_delivery_days',
  'brief_delivery_hour',
  'brief_delivery_tz',
]);

/**
 * POST /api/profile/update
 * Generic profile update endpoint. Tries admin client first, then
 * falls back to authenticated server client with verification.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Filter to only allowed fields
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Try admin client first (bypasses RLS)
  let adminAvailable = false;
  try {
    const admin = createAdminClient();
    adminAvailable = true;

    const { error, data } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id')
      .single();

    if (error) {
      console.error('[Profile Update] Admin update error:', error);
      return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
    }

    if (!data) {
      console.error('[Profile Update] Admin update returned no rows for user:', user.id);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ saved: true });
  } catch (adminErr) {
    if (adminAvailable) {
      // Admin client was created but the query failed
      console.error('[Profile Update] Admin query failed:', adminErr);
      return NextResponse.json({ error: 'Save failed' }, { status: 500 });
    }
    console.warn('[Profile Update] Admin client unavailable, using server client');
  }

  // Fallback: use the authenticated server client
  const { error, data } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id')
    .single();

  if (error) {
    console.error('[Profile Update] Server update error:', error);
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
  }

  if (!data) {
    console.error('[Profile Update] Server update returned no rows — RLS may be blocking writes');
    return NextResponse.json({ error: 'Save failed — no rows updated' }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
