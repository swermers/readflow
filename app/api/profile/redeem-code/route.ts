export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code || '').trim();
  if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

  const { data, error } = await supabase.rpc('redeem_access_code', {
    p_user_id: user.id,
    p_code: code,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: 'Could not redeem code' }, { status: 500 });
  }

  const row = data[0] as {
    success: boolean;
    message: string;
    plan_tier: string;
    unlimited_ai_access: boolean;
  };

  if (!row.success) {
    return NextResponse.json({ error: row.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: row.message,
    planTier: row.plan_tier,
    unlimitedAiAccess: row.unlimited_ai_access,
  });
}
