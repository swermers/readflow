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
 * Generic profile update endpoint using admin client to bypass RLS.
 * Only allows updating fields in the ALLOWED_FIELDS allowlist.
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

  // Use admin client to bypass RLS
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    db = supabase as any;
  }

  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.error('[Profile Update] Failed:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
