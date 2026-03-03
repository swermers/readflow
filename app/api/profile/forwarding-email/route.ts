import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

const INGEST_DOMAIN = 'readflowlibrary.xyz';

function generateAlias(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * GET /api/profile/forwarding-email
 * Returns the user's forwarding email address.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('forwarding_alias')
    .eq('id', user.id)
    .single();

  if (!profile?.forwarding_alias) {
    return NextResponse.json({ error: 'No forwarding alias found' }, { status: 404 });
  }

  return NextResponse.json({
    alias: profile.forwarding_alias,
    email: `${profile.forwarding_alias}@${INGEST_DOMAIN}`,
    domain: INGEST_DOMAIN,
  });
}

/**
 * POST /api/profile/forwarding-email
 * Regenerate the user's forwarding alias (e.g. if they're getting spam).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const newAlias = generateAlias();

  // Use admin client to bypass RLS
  let db;
  try {
    db = createAdminClient();
  } catch {
    db = supabase;
  }

  const { error: updateError } = await db
    .from('profiles')
    .update({ forwarding_alias: newAlias })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to regenerate alias' }, { status: 500 });
  }

  return NextResponse.json({
    alias: newAlias,
    email: `${newAlias}@${INGEST_DOMAIN}`,
    domain: INGEST_DOMAIN,
  });
}
