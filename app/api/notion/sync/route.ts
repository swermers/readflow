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

  const admin = createAdminClient();
  await enqueueJob(admin, 'notion.sync', { userId: user.id }, `notion-sync:${user.id}`);

  return NextResponse.json({ status: 'queued' }, { status: 202 });
}
