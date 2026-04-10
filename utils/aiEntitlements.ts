import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'free' | 'pro' | 'elite';
export type EntitlementAction = 'tldr' | 'listen' | 'weekly_brief' | 'notion_sync';

type WalletProfile = {
  token_balance: number | null;
  unlimited_ai_access?: boolean | null;
  plan_tier?: string | null;
};

export type EnsureResult = {
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
  error: string;
  code: 'PAYMENT_REQUIRED';
  required: number;
  available: number;
};

export const TOKENS_PER_CREDIT = 10;

export function getActionTokenCost(action: EntitlementAction) {
  if (action === 'tldr') return 5;
  if (action === 'listen') return 10;
  if (action === 'weekly_brief') return 10;
  return 0;
}

function normalizeTier(rawTier: string | null | undefined): PlanTier {
  if (rawTier === 'elite' || rawTier === 'pro') return rawTier;
  return 'free';
}

export function format402Payload(result: EnsureResult) {
  return {
    error: 'Insufficient tokens — purchase more to continue',
    code: 'PAYMENT_REQUIRED' as const,
    required: result.required,
    available: result.available,
  };
}

/**
 * Check if the user's wallet has enough tokens for an action.
 * No rolling cycle — balance is the source of truth.
 */
export async function ensureTokensAvailable(
  supabase: SupabaseClient,
  userId: string,
  tokensNeeded: number,
): Promise<EnsureResult> {
  const { data: profile } = await supabase
    .from('profile_billing')
    .select('token_balance, unlimited_ai_access, plan_tier')
    .eq('user_id', userId)
    .single<WalletProfile>();

  const tier = normalizeTier(profile?.plan_tier);

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

  const balance = Math.max(0, profile?.token_balance ?? 0);

  if (balance < tokensNeeded) {
    return {
      allowed: false,
      available: balance,
      remaining: balance,
      required: tokensNeeded,
      limit: balance,
      tier,
      resetAt: '',
      reason: 'Insufficient tokens',
    };
  }

  return {
    allowed: true,
    available: balance,
    remaining: balance,
    required: tokensNeeded,
    limit: balance,
    tier,
    resetAt: '',
  };
}

/**
 * Atomically deduct tokens from the user's wallet using the DB function.
 * Logs the transaction in token_transactions.
 */
export async function consumeTokensAtomic(
  supabase: SupabaseClient,
  userId: string,
  tokens: number,
  description?: string,
): Promise<EnsureResult> {
  const preflight = await ensureTokensAvailable(supabase, userId, tokens);
  if (!preflight.allowed || preflight.unlimitedAiAccess || tokens <= 0) {
    return preflight;
  }

  const { data, error } = await supabase.rpc('spend_wallet_tokens', {
    p_user_id: userId,
    p_tokens: tokens,
    p_description: description || null,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as {
      success: boolean;
      balance_after: number;
      reason?: string | null;
    };

    if (!row.success) {
      return {
        allowed: false,
        available: row.balance_after,
        remaining: row.balance_after,
        required: tokens,
        limit: row.balance_after,
        tier: preflight.tier,
        resetAt: '',
        reason: row.reason || 'Insufficient tokens',
      };
    }

    return {
      allowed: true,
      available: row.balance_after,
      remaining: row.balance_after,
      required: tokens,
      limit: row.balance_after,
      tier: preflight.tier,
      resetAt: '',
    };
  }

  // Fallback: RPC not available, do manual update
  const { data: currentBilling } = await supabase
    .from('profile_billing')
    .select('token_balance')
    .eq('user_id', userId)
    .single<{ token_balance: number | null }>();

  const currentBalance = Math.max(0, currentBilling?.token_balance ?? 0);
  if (currentBalance < tokens) {
    return {
      ...preflight,
      allowed: false,
      available: currentBalance,
      remaining: currentBalance,
      reason: 'Insufficient tokens',
    };
  }

  const newBalance = currentBalance - tokens;
  await supabase
    .from('profile_billing')
    .update({ token_balance: newBalance })
    .eq('user_id', userId);

  return {
    ...preflight,
    available: newBalance,
    remaining: newBalance,
  };
}

export async function checkEntitlement(
  supabase: SupabaseClient,
  userId: string,
  action: EntitlementAction,
): Promise<EnsureResult> {
  const required = getActionTokenCost(action);
  return ensureTokensAvailable(supabase, userId, required);
}

// Backward-compatible aliases
export function getMonthlyTokenLimit(_tier: PlanTier) {
  return -1; // No monthly limit in pay-per-use model
}
export const getMonthlyCreditLimit = getMonthlyTokenLimit;
export const ensureCreditsAvailable = ensureTokensAvailable;
export const consumeCreditsAtomic = consumeTokensAtomic;
