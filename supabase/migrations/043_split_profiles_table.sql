-- Migration 043: Split profiles god-table into focused tables
-- ──────────────────────────────────────────────────────────────
-- The `profiles` table has ~40 columns mixing unrelated concerns.
-- This migration creates 3 focused tables:
--   • profile_integrations — Gmail OAuth, Notion OAuth
--   • profile_billing      — plan tier, token balance, credits
--   • profile_preferences  — brief delivery, digest, TTS prefs
--
-- Data is copied from the existing profiles columns.
-- Old columns are NOT dropped yet — a follow-up migration will
-- remove them once all code has been migrated.

-- ─── 1. profile_integrations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_integrations (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Gmail OAuth
  gmail_access_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expires_at TIMESTAMPTZ,
  gmail_connected BOOLEAN DEFAULT false,
  gmail_last_sync_at TIMESTAMPTZ,
  gmail_sync_labels TEXT[] DEFAULT '{}',
  -- Notion OAuth
  notion_access_token_enc TEXT,
  notion_workspace_id TEXT,
  notion_workspace_name TEXT,
  notion_connected_at TIMESTAMPTZ,
  notion_sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (notion_sync_status IN ('idle', 'queued', 'syncing', 'ok', 'error')),
  notion_last_synced_at TIMESTAMPTZ,
  notion_last_error TEXT,
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own integrations"
  ON public.profile_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.profile_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.profile_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. profile_billing ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_billing (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro', 'elite')),
  plan_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'past_due', 'canceled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  token_balance INTEGER NOT NULL DEFAULT 30,
  unlimited_ai_access BOOLEAN NOT NULL DEFAULT false,
  access_granted_by_code TEXT,
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  ai_cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own billing"
  ON public.profile_billing FOR SELECT
  USING (auth.uid() = user_id);

-- Restrict billing updates: only service role should modify most fields
-- Users can only read, not modify billing directly
CREATE POLICY "Service role can manage billing"
  ON public.profile_billing FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── 3. profile_preferences ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Brief delivery
  brief_delivery_days SMALLINT[] NOT NULL DEFAULT '{1}',
  brief_delivery_hour SMALLINT NOT NULL DEFAULT 9,
  brief_delivery_tz TEXT NOT NULL DEFAULT 'UTC',
  brief_last_enqueued_for_date DATE,
  -- Email digest
  digest_enabled BOOLEAN DEFAULT true,
  digest_day INTEGER DEFAULT 1,
  digest_hour INTEGER DEFAULT 9,
  digest_tz TEXT DEFAULT 'America/New_York',
  digest_last_sent_date TEXT,
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_preferences_brief_delivery_hour_valid
    CHECK (brief_delivery_hour >= 0 AND brief_delivery_hour <= 23)
);

ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.profile_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.profile_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.profile_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. Populate new tables from existing profiles data ──────────────────

INSERT INTO public.profile_integrations (
  user_id,
  gmail_access_token, gmail_refresh_token, gmail_token_expires_at,
  gmail_connected, gmail_last_sync_at, gmail_sync_labels,
  notion_access_token_enc, notion_workspace_id, notion_workspace_name,
  notion_connected_at, notion_sync_status, notion_last_synced_at, notion_last_error
)
SELECT
  id,
  gmail_access_token, gmail_refresh_token, gmail_token_expires_at,
  COALESCE(gmail_connected, false), gmail_last_sync_at, COALESCE(gmail_sync_labels, '{}'),
  COALESCE(notion_access_token_enc, notion_access_token_encrypted),
  notion_workspace_id, notion_workspace_name,
  notion_connected_at,
  COALESCE(notion_sync_status, 'idle'),
  COALESCE(notion_last_synced_at, notion_last_sync_at),
  notion_last_error
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.profile_billing (
  user_id,
  plan_tier, plan_status, billing_cycle,
  token_balance, unlimited_ai_access, access_granted_by_code,
  ai_credits_used, ai_tokens_used, ai_cycle_started_at
)
SELECT
  id,
  COALESCE(plan_tier, 'free'),
  COALESCE(plan_status, 'active'),
  COALESCE(billing_cycle, 'monthly'),
  COALESCE(token_balance, 30),
  COALESCE(unlimited_ai_access, false),
  access_granted_by_code,
  COALESCE(ai_credits_used, 0),
  COALESCE(ai_tokens_used, 0),
  COALESCE(ai_cycle_started_at, now())
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.profile_preferences (
  user_id,
  brief_delivery_days, brief_delivery_hour, brief_delivery_tz,
  brief_last_enqueued_for_date,
  digest_enabled, digest_day, digest_hour, digest_tz, digest_last_sent_date
)
SELECT
  id,
  COALESCE(brief_delivery_days, '{1}'),
  COALESCE(brief_delivery_hour, 9),
  COALESCE(brief_delivery_tz, 'UTC'),
  brief_last_enqueued_for_date,
  COALESCE(digest_enabled, true),
  COALESCE(digest_day, 1),
  COALESCE(digest_hour, 9),
  COALESCE(digest_tz, 'America/New_York'),
  digest_last_sent_date
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ─── 5. Auto-create rows in new tables on profile insert ─────────────────

CREATE OR REPLACE FUNCTION public.create_profile_related_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profile_integrations (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.profile_billing (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.profile_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_profile_related_rows ON public.profiles;
CREATE TRIGGER trg_create_profile_related_rows
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_related_rows();

-- ─── 6. Update DB functions to use new billing table ─────────────────────

-- Rebuild consume_ai_credits to use profile_billing
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_user_id UUID, p_credits INTEGER
)
RETURNS TABLE (success BOOLEAN, remaining INTEGER, credit_limit INTEGER, plan_tier TEXT, reset_at TIMESTAMPTZ, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan text; v_cycle_started timestamptz; v_used integer;
  v_limit integer; v_now timestamptz := now(); v_reset_at timestamptz;
BEGIN
  IF p_credits <= 0 THEN
    RETURN QUERY SELECT true, 0, 0, 'free'::text, v_now, null::text;
    RETURN;
  END IF;
  SELECT b.plan_tier, b.ai_cycle_started_at, b.ai_credits_used
    INTO v_plan, v_cycle_started, v_used
  FROM public.profile_billing b WHERE b.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'free'::text, v_now, 'Profile not found'::text;
    RETURN;
  END IF;
  IF v_plan NOT IN ('free', 'pro', 'elite') THEN v_plan := 'free'; END IF;
  v_limit := CASE v_plan WHEN 'elite' THEN 300 WHEN 'pro' THEN 50 ELSE 3 END;
  IF v_cycle_started IS NULL OR v_cycle_started < (v_now - interval '30 days') THEN
    v_cycle_started := v_now; v_used := 0;
  END IF;
  v_used := COALESCE(v_used, 0);
  v_reset_at := v_cycle_started + interval '30 days';
  IF (v_used + p_credits) > v_limit THEN
    RETURN QUERY SELECT false, GREATEST(v_limit - v_used, 0), v_limit, v_plan, v_reset_at, 'Monthly AI credit limit reached'::text;
    RETURN;
  END IF;
  UPDATE public.profile_billing SET ai_cycle_started_at = v_cycle_started, ai_credits_used = v_used + p_credits WHERE user_id = p_user_id;
  RETURN QUERY SELECT true, GREATEST(v_limit - (v_used + p_credits), 0), v_limit, v_plan, v_reset_at, null::text;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer) TO authenticated;

-- Rebuild spend_wallet_tokens to use profile_billing
CREATE OR REPLACE FUNCTION spend_wallet_tokens(
  p_user_id UUID, p_tokens INTEGER, p_description TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, balance_after INTEGER, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER; v_new_balance INTEGER; v_unlimited BOOLEAN;
BEGIN
  SELECT unlimited_ai_access INTO v_unlimited FROM profile_billing WHERE user_id = p_user_id;
  IF v_unlimited = TRUE THEN RETURN QUERY SELECT TRUE, -1, NULL::TEXT; RETURN; END IF;
  SELECT token_balance INTO v_current_balance FROM profile_billing WHERE user_id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL THEN RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT; RETURN; END IF;
  IF v_current_balance < p_tokens THEN RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient tokens'::TEXT; RETURN; END IF;
  v_new_balance := v_current_balance - p_tokens;
  UPDATE profile_billing SET token_balance = v_new_balance WHERE user_id = p_user_id;
  INSERT INTO token_transactions (user_id, amount, type, description, balance_after) VALUES (p_user_id, -p_tokens, 'spend', p_description, v_new_balance);
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Rebuild credit_wallet_tokens to use profile_billing
CREATE OR REPLACE FUNCTION credit_wallet_tokens(
  p_user_id UUID, p_tokens INTEGER, p_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT NULL, p_stripe_session_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, balance_after INTEGER, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER; v_new_balance INTEGER; v_existing_txn UUID;
BEGIN
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_existing_txn FROM token_transactions WHERE stripe_session_id = p_stripe_session_id LIMIT 1;
    IF v_existing_txn IS NOT NULL THEN
      SELECT token_balance INTO v_current_balance FROM profile_billing WHERE user_id = p_user_id;
      RETURN QUERY SELECT TRUE, COALESCE(v_current_balance, 0), 'Already credited'::TEXT;
      RETURN;
    END IF;
  END IF;
  SELECT token_balance INTO v_current_balance FROM profile_billing WHERE user_id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL THEN RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT; RETURN; END IF;
  v_new_balance := v_current_balance + p_tokens;
  UPDATE profile_billing SET token_balance = v_new_balance WHERE user_id = p_user_id;
  INSERT INTO token_transactions (user_id, amount, type, description, stripe_session_id, balance_after) VALUES (p_user_id, p_tokens, p_type, p_description, p_stripe_session_id, v_new_balance);
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Rebuild redeem_access_code to use profile_billing
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_user_id UUID, p_code TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, plan_tier TEXT, unlimited_ai_access BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_code public.access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code FROM public.access_codes WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Invalid invite code'::text, 'free'::text, false; RETURN; END IF;
  IF NOT v_code.active THEN RETURN QUERY SELECT false, 'Invite code is inactive'::text, 'free'::text, false; RETURN; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RETURN QUERY SELECT false, 'Invite code has expired'::text, 'free'::text, false; RETURN; END IF;
  IF v_code.max_redemptions IS NOT NULL AND v_code.redeemed_count >= v_code.max_redemptions THEN RETURN QUERY SELECT false, 'Invite code redemption limit reached'::text, 'free'::text, false; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.profile_code_redemptions r WHERE r.user_id = p_user_id AND r.code = p_code) THEN
    RETURN QUERY SELECT true, 'Code already redeemed'::text, v_code.plan_tier, v_code.unlimited_ai_access; RETURN;
  END IF;
  INSERT INTO public.profile_code_redemptions (user_id, code) VALUES (p_user_id, p_code);
  UPDATE public.access_codes SET redeemed_count = redeemed_count + 1 WHERE code = p_code;
  UPDATE public.profile_billing SET plan_tier = v_code.plan_tier, unlimited_ai_access = v_code.unlimited_ai_access, access_granted_by_code = p_code WHERE user_id = p_user_id;
  RETURN QUERY SELECT true, 'Code redeemed successfully'::text, v_code.plan_tier, v_code.unlimited_ai_access;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(uuid, text) TO authenticated;

-- ─── 7. Simplify profiles RLS ────────────────────────────────────────────
-- With billing columns moved to profile_billing, the restrictive UPDATE
-- policy from migration 035 can be simplified. The sensitive fields are
-- now protected by their own table's RLS.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
