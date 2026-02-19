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

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('notion_connected')
    .eq('id', user.id)
    .maybeSingle<{ notion_connected: boolean }>();

  if (!profile?.notion_connected) {
    return NextResponse.json({ error: 'Notion is not connected' }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ notion_sync_status: 'queued', notion_last_sync_error: null })
    .eq('id', user.id);

  await enqueueJob(admin, 'notion.sync', { userId: user.id, reason: 'manual' }, `notion-sync:${user.id}`);

  return NextResponse.json({ ok: true, message: 'Notion sync queued' });
}
