export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { getMonthlyCreditLimit } from '@/utils/aiEntitlements';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier, billing_cycle, ai_credits_used, unlimited_ai_access')
    .eq('id', user.id)
    .single();

  const tier = (profile?.plan_tier || 'free') as 'free' | 'pro' | 'elite';
  const unlimited = Boolean(profile?.unlimited_ai_access);
  const limit = unlimited ? -1 : getMonthlyCreditLimit(tier);
  const used = Math.max(0, profile?.ai_credits_used || 0);

  return NextResponse.json({
    planTier: tier,
    billingCycle: profile?.billing_cycle || 'monthly',
    unlimitedAiAccess: unlimited,
    creditsUsed: used,
    creditsLimit: limit,
    creditsRemaining: unlimited ? -1 : Math.max(0, limit - used),
  });
}
