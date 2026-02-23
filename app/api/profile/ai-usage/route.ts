export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier, token_balance, unlimited_ai_access')
    .eq('id', user.id)
    .single();

  const tier = (profile?.plan_tier || 'free') as 'free' | 'pro' | 'elite';
  const unlimited = Boolean(profile?.unlimited_ai_access);
  const balance = unlimited ? -1 : Math.max(0, profile?.token_balance ?? 0);

  return NextResponse.json({
    planTier: tier,
    unlimitedAiAccess: unlimited,
    tokenBalance: balance,
    // Backward compat fields for existing UI
    tokensUsed: 0,
    tokensLimit: balance,
    tokensRemaining: balance,
    creditsUsed: 0,
    creditsLimit: unlimited ? -1 : balance,
    creditsRemaining: balance,
  });
}
