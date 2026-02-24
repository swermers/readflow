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

  // Try with token_balance first (from migration 030), fall back without it
  let profile: Record<string, unknown> | null = null;
  const { data: p1 } = await supabase
    .from('profiles')
    .select('plan_tier, token_balance, unlimited_ai_access')
    .eq('id', user.id)
    .single();

  if (p1) {
    profile = p1;
  } else {
    // token_balance column may not exist if migration 030 wasn't run
    const { data: p2 } = await supabase
      .from('profiles')
      .select('plan_tier, unlimited_ai_access')
      .eq('id', user.id)
      .single();
    profile = p2;
  }

  const tier = (profile?.plan_tier || 'free') as 'free' | 'pro' | 'elite';
  const unlimited = Boolean(profile?.unlimited_ai_access);
  const balance = unlimited ? -1 : Math.max(0, (profile?.token_balance as number) ?? 0);

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
