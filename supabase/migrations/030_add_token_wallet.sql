-- Migration 030: Pay-per-use token wallet
-- Replaces the rolling 30-day cycle with a prepaid wallet balance.
-- Users buy token packs via Stripe Checkout; balance decrements on each AI action.

-- 1. Add wallet balance to profiles (seed existing users with remaining tokens)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS token_balance INTEGER NOT NULL DEFAULT 30;

-- Migrate existing users: give them back their remaining tokens from current cycle
UPDATE profiles
SET token_balance = GREATEST(30, (
  CASE
    WHEN unlimited_ai_access = TRUE THEN 1000
    WHEN plan_tier = 'elite' THEN GREATEST(0, 1000 - COALESCE(ai_tokens_used, 0))
    WHEN plan_tier = 'pro' THEN GREATEST(0, 500 - COALESCE(ai_tokens_used, 0))
    ELSE GREATEST(0, 30 - COALESCE(ai_tokens_used, 0))
  END
));

-- 2. Token transaction ledger
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- positive = credit, negative = debit
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'bonus', 'refund', 'signup')),
  description TEXT,
  stripe_session_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user
  ON token_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_transactions_stripe
  ON token_transactions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- RLS: users can only see their own transactions
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON token_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (server-side only)
CREATE POLICY "Service role can insert transactions"
  ON token_transactions FOR INSERT
  WITH CHECK (TRUE);

-- 3. Atomic wallet spend function
-- Returns: success, balance_after, reason
CREATE OR REPLACE FUNCTION spend_wallet_tokens(
  p_user_id UUID,
  p_tokens INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  balance_after INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_unlimited BOOLEAN;
BEGIN
  -- Check unlimited access override
  SELECT unlimited_ai_access INTO v_unlimited
  FROM profiles WHERE id = p_user_id;

  IF v_unlimited = TRUE THEN
    RETURN QUERY SELECT TRUE, -1, NULL::TEXT;
    RETURN;
  END IF;

  -- Lock the row and get current balance
  SELECT token_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_tokens THEN
    RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient tokens'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_tokens;

  UPDATE profiles
  SET token_balance = v_new_balance
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO token_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, -p_tokens, 'spend', p_description, v_new_balance);

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- 4. Wallet credit function (used by webhook after Stripe payment)
CREATE OR REPLACE FUNCTION credit_wallet_tokens(
  p_user_id UUID,
  p_tokens INTEGER,
  p_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT NULL,
  p_stripe_session_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  balance_after INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_existing_txn UUID;
BEGIN
  -- Idempotency: if this stripe session was already credited, skip
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_existing_txn
    FROM token_transactions
    WHERE stripe_session_id = p_stripe_session_id
    LIMIT 1;

    IF v_existing_txn IS NOT NULL THEN
      SELECT token_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT TRUE, COALESCE(v_current_balance, 0), 'Already credited'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Lock and credit
  SELECT token_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance + p_tokens;

  UPDATE profiles
  SET token_balance = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO token_transactions (user_id, amount, type, description, stripe_session_id, balance_after)
  VALUES (p_user_id, p_tokens, p_type, p_description, p_stripe_session_id, v_new_balance);

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;
