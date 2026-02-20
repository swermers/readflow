export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkEntitlement, format402Payload } from '@/utils/aiEntitlements';
import { enqueueJob } from '@/utils/jobs';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('notion_access_token_enc')
    .eq('id', user.id)
    .maybeSingle<{ notion_access_token_enc: string | null }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile?.notion_access_token_enc) {
    return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ notion_sync_status: 'queued', notion_last_error: null })
    .eq('id', user.id);

  await enqueueJob(admin, 'notion.sync', { userId: user.id }, `notion-sync:${user.id}`, { maxAttempts: 5 });

  return NextResponse.json({ status: 'queued' }, { status: 202 });
}
