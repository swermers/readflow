export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { getMonthlyTokenLimit, TOKENS_PER_CREDIT } from '@/utils/aiEntitlements';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier, billing_cycle, ai_tokens_used, ai_credits_used, unlimited_ai_access')
    .eq('id', user.id)
    .single();

  const tier = (profile?.plan_tier || 'free') as 'free' | 'pro' | 'elite';
  const unlimited = Boolean(profile?.unlimited_ai_access);
  const limit = unlimited ? -1 : getMonthlyTokenLimit(tier);
  const used = Math.max(0, profile?.ai_tokens_used ?? (profile?.ai_credits_used || 0) * TOKENS_PER_CREDIT);

  return NextResponse.json({
    planTier: tier,
    billingCycle: profile?.billing_cycle || 'monthly',
    unlimitedAiAccess: unlimited,
    tokensUsed: used,
    tokensLimit: limit,
    tokensRemaining: unlimited ? -1 : Math.max(0, limit - used),
    creditsUsed: Math.floor(used / TOKENS_PER_CREDIT),
    creditsLimit: unlimited ? -1 : limit / TOKENS_PER_CREDIT,
    creditsRemaining: unlimited ? -1 : Math.max(0, limit - used) / TOKENS_PER_CREDIT,
  });
}
