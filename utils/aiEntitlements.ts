import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'free' | 'pro' | 'elite';

type ProfileEntitlements = {
  plan_tier: string | null;
  ai_cycle_started_at: string | null;
  ai_credits_used: number | null;
};

type EnsureResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  tier: PlanTier;
  resetAt: string;
  reason?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_CYCLE_DAYS = 30;

export function getMonthlyCreditLimit(tier: PlanTier) {
  if (tier === 'elite') return 300;
  if (tier === 'pro') return 50;
  return 3;
}

function normalizeTier(rawTier: string | null | undefined): PlanTier {
  if (rawTier === 'elite' || rawTier === 'pro') return rawTier;
  return 'free';
}

function getCycleStartIso(startAt: string | null | undefined) {
  return startAt || new Date().toISOString();
}

function isCycleExpired(startAt: string | null | undefined) {
  if (!startAt) return true;
  const ageMs = Date.now() - new Date(startAt).getTime();
  return !Number.isFinite(ageMs) || ageMs >= BILLING_CYCLE_DAYS * DAY_MS;
}

export async function ensureCreditsAvailable(
  supabase: SupabaseClient,
  userId: string,
  creditsNeeded: number,
): Promise<EnsureResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier, ai_cycle_started_at, ai_credits_used')
    .eq('id', userId)
    .single<ProfileEntitlements>();

  const tier = normalizeTier(profile?.plan_tier);
  const limit = getMonthlyCreditLimit(tier);

  let cycleStartedAt = getCycleStartIso(profile?.ai_cycle_started_at);
  let used = Math.max(0, profile?.ai_credits_used || 0);

  if (isCycleExpired(profile?.ai_cycle_started_at)) {
    cycleStartedAt = new Date().toISOString();
    used = 0;

    await supabase
      .from('profiles')
      .update({ ai_cycle_started_at: cycleStartedAt, ai_credits_used: 0 })
      .eq('id', userId);
  }

  const remaining = Math.max(0, limit - used);
  if (remaining < creditsNeeded) {
    const resetAt = new Date(new Date(cycleStartedAt).getTime() + BILLING_CYCLE_DAYS * DAY_MS).toISOString();
    return {
      allowed: false,
      remaining,
      limit,
      tier,
      resetAt,
      reason: 'Monthly AI credit limit reached',
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
    tier,
    resetAt: new Date(new Date(cycleStartedAt).getTime() + BILLING_CYCLE_DAYS * DAY_MS).toISOString(),
  };
}

export async function consumeCreditsAtomic(supabase: SupabaseClient, userId: string, credits: number): Promise<EnsureResult> {
  const { data, error } = await supabase.rpc('consume_ai_credits', {
    p_user_id: userId,
    p_credits: credits,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as {
      success: boolean;
      remaining: number;
      credit_limit: number;
      plan_tier: string;
      reset_at: string;
      reason?: string | null;
    };

    return {
      allowed: Boolean(row.success),
      remaining: row.remaining ?? 0,
      limit: row.credit_limit ?? 0,
      tier: normalizeTier(row.plan_tier),
      resetAt: row.reset_at || new Date().toISOString(),
      reason: row.reason || undefined,
    };
  }

  // Backward-compatible fallback when function isn't deployed yet.
  const gate = await ensureCreditsAvailable(supabase, userId, credits);
  if (!gate.allowed) return gate;

  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_credits_used, ai_cycle_started_at')
    .eq('id', userId)
    .single<{ ai_credits_used: number | null; ai_cycle_started_at: string | null }>();

  let used = Math.max(0, profile?.ai_credits_used || 0);
  let cycleStartedAt = profile?.ai_cycle_started_at;

  if (isCycleExpired(cycleStartedAt)) {
    used = 0;
    cycleStartedAt = new Date().toISOString();
  }

  await supabase
    .from('profiles')
    .update({
      ai_credits_used: used + credits,
      ai_cycle_started_at: cycleStartedAt || new Date().toISOString(),
    })
    .eq('id', userId);

  return {
    ...gate,
    remaining: Math.max(0, gate.remaining - credits),
  };
}
