import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'free' | 'pro' | 'elite';
export type EntitlementAction = 'tldr' | 'listen' | 'weekly_brief' | 'notion_sync';

type ProfileEntitlements = {
  plan_tier: string | null;
  ai_cycle_started_at: string | null;
  ai_tokens_used: number | null;
  ai_credits_used: number | null;
  unlimited_ai_access?: boolean | null;
};

type EnsureResult = {
  allowed: boolean;
  available: number;
  remaining: number;
  required: number;
  limit: number;
  tier: PlanTier;
  resetAt: string;
  reason?: string;
  unlimitedAiAccess?: boolean;
};

export type PaymentRequiredPayload = {
  error: 'Insufficient tokens';
  code: 'PAYMENT_REQUIRED';
  message: string;
  reason: string;
  required: number;
  available: number;
  limit: number;
  planTier: PlanTier;
  resetAt: string;
  unlimitedAiAccess: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_CYCLE_DAYS = 30;

export const TOKENS_PER_CREDIT = 10;

export function getMonthlyTokenLimit(tier: PlanTier) {
  if (tier === 'elite') return 1000;
  if (tier === 'pro') return 500;
  return 30;
}

export function getActionTokenCost(action: EntitlementAction) {
  if (action === 'tldr') return 5;
  if (action === 'listen') return 10;
  return 0;
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

export function format402Payload(result: EnsureResult): PaymentRequiredPayload {
  return {
    error: 'Insufficient tokens',
    code: 'PAYMENT_REQUIRED',
    message: result.reason || 'Insufficient tokens',
    reason: result.reason || 'Insufficient tokens',
    required: result.required,
    available: result.available,
    limit: result.limit,
    planTier: result.tier,
    resetAt: result.resetAt,
    unlimitedAiAccess: Boolean(result.unlimitedAiAccess),
  };
}

export async function ensureTokensAvailable(
  supabase: SupabaseClient,
  userId: string,
  tokensNeeded: number,
): Promise<EnsureResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier, ai_cycle_started_at, ai_tokens_used, ai_credits_used, unlimited_ai_access')
    .eq('id', userId)
    .single<ProfileEntitlements>();

  const tier = normalizeTier(profile?.plan_tier);
  const limit = getMonthlyTokenLimit(tier);

  let cycleStartedAt = getCycleStartIso(profile?.ai_cycle_started_at);

  if (profile?.unlimited_ai_access) {
    return {
      allowed: true,
      available: -1,
      remaining: -1,
      required: tokensNeeded,
      limit: -1,
      tier,
      resetAt: new Date().toISOString(),
      unlimitedAiAccess: true,
    };
  }

  let used = Math.max(0, profile?.ai_tokens_used ?? (profile?.ai_credits_used || 0) * TOKENS_PER_CREDIT);

  if (isCycleExpired(profile?.ai_cycle_started_at)) {
    cycleStartedAt = new Date().toISOString();
    used = 0;

    await supabase
      .from('profiles')
      .update({ ai_cycle_started_at: cycleStartedAt, ai_tokens_used: 0, ai_credits_used: 0 })
      .eq('id', userId);
  }

  const available = Math.max(0, limit - used);
  if (available < tokensNeeded) {
    const resetAt = new Date(new Date(cycleStartedAt).getTime() + BILLING_CYCLE_DAYS * DAY_MS).toISOString();
    return {
      allowed: false,
      available,
      remaining: available,
      required: tokensNeeded,
      limit,
      tier,
      resetAt,
      reason: 'Insufficient tokens',
    };
  }

  return {
    allowed: true,
    available,
    remaining: available,
    required: tokensNeeded,
    limit,
    tier,
    resetAt: new Date(new Date(cycleStartedAt).getTime() + BILLING_CYCLE_DAYS * DAY_MS).toISOString(),
  };
}

export async function consumeTokensAtomic(supabase: SupabaseClient, userId: string, tokens: number): Promise<EnsureResult> {
  const preflight = await ensureTokensAvailable(supabase, userId, tokens);
  if (!preflight.allowed || preflight.unlimitedAiAccess || tokens <= 0) {
    return preflight;
  }

  const { data, error } = await supabase.rpc('consume_ai_tokens', {
    p_user_id: userId,
    p_tokens: tokens,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as {
      success: boolean;
      available: number;
      token_limit: number;
      plan_tier: string;
      reset_at: string;
      reason?: string | null;
      required?: number | null;
    };

    return {
      allowed: Boolean(row.success),
      available: row.available ?? 0,
      remaining: row.available ?? 0,
      required: row.required ?? tokens,
      limit: row.token_limit ?? 0,
      tier: normalizeTier(row.plan_tier),
      resetAt: row.reset_at || new Date().toISOString(),
      reason: row.reason || undefined,
      unlimitedAiAccess: row.token_limit === -1,
    };
  }

  const gate = preflight;

  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_tokens_used, ai_credits_used, ai_cycle_started_at')
    .eq('id', userId)
    .single<{ ai_tokens_used: number | null; ai_credits_used: number | null; ai_cycle_started_at: string | null }>();

  let used = Math.max(0, profile?.ai_tokens_used ?? (profile?.ai_credits_used || 0) * TOKENS_PER_CREDIT);
  let cycleStartedAt = profile?.ai_cycle_started_at;

  if (isCycleExpired(cycleStartedAt)) {
    used = 0;
    cycleStartedAt = new Date().toISOString();
  }

  const nextUsed = used + tokens;
  await supabase
    .from('profiles')
    .update({
      ai_tokens_used: nextUsed,
      ai_credits_used: Math.floor(nextUsed / TOKENS_PER_CREDIT),
      ai_cycle_started_at: cycleStartedAt || new Date().toISOString(),
    })
    .eq('id', userId);

  return {
    ...gate,
    available: gate.available < 0 ? -1 : Math.max(0, gate.available - tokens),
    remaining: gate.available < 0 ? -1 : Math.max(0, gate.available - tokens),
  };
}

export async function checkEntitlement(
  supabase: SupabaseClient,
  userId: string,
  action: EntitlementAction,
): Promise<EnsureResult> {
  const required = getActionTokenCost(action);
  const gate = await ensureTokensAvailable(supabase, userId, required);

  if (!gate.allowed) {
    return { ...gate, required };
  }

  if ((action === 'weekly_brief' || action === 'notion_sync') && gate.tier !== 'elite') {
    return {
      ...gate,
      allowed: false,
      required,
      reason: 'Insufficient tokens',
      available: gate.available,
    };
  }

  return { ...gate, required };
}


// Backward-compatible alias during credits->tokens migration.
export const getMonthlyCreditLimit = getMonthlyTokenLimit;
