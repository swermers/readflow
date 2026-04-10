import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

/** Allowlist of profile columns that can be updated from the client. */
const PROFILE_FIELDS = new Set(['full_name']);
const PREFERENCE_FIELDS = new Set([
  'brief_delivery_days',
  'brief_delivery_hour',
  'brief_delivery_tz',
]);
const ALLOWED_FIELDS = new Set(Array.from(PROFILE_FIELDS).concat(Array.from(PREFERENCE_FIELDS)));

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

  // Split updates between profiles (core) and profile_preferences
  const profileUpdates: Record<string, unknown> = {};
  const prefUpdates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (PROFILE_FIELDS.has(key)) profileUpdates[key] = val;
    if (PREFERENCE_FIELDS.has(key)) prefUpdates[key] = val;
  }

  let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>;
  try {
    db = createAdminClient();
  } catch {
    db = supabase;
  }

  const errors: string[] = [];

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await db.from('profiles').update(profileUpdates).eq('id', user.id);
    if (error) errors.push(error.message);
  }

  if (Object.keys(prefUpdates).length > 0) {
    const { error } = await db.from('profile_preferences').update(prefUpdates).eq('user_id', user.id);
    if (error) errors.push(error.message);
  }

  if (errors.length > 0) {
    console.error('[Profile Update] Errors:', errors);
    return NextResponse.json({ error: `Save failed: ${errors.join('; ')}` }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
