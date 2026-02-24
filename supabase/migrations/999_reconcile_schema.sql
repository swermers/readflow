-- ============================================================================
-- Readflow Schema Reconciliation
-- ============================================================================
-- Safe to run multiple times. Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- everywhere so it won't break anything that already exists.
--
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================================


-- ─── 1. PROFILES — ensure all columns exist ────────────────────────────────

-- The app uses full_name (not first_name/last_name).
-- If your DB still has first_name/last_name from the original migration,
-- this adds full_name alongside them. The app only reads full_name.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Gmail columns (migration 002)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
  ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gmail_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_last_sync_at TIMESTAMPTZ;

-- Gmail sync labels (migration 003)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_sync_labels TEXT[] DEFAULT '{}';

-- Onboarding flag (migration 007)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Plan & AI credits (migration 010)
-- Using DO blocks to handle CHECK constraints gracefully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan_tier'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN plan_tier text NOT NULL DEFAULT 'free'
      CHECK (plan_tier IN ('free', 'pro', 'elite'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly'
      CHECK (billing_cycle IN ('monthly', 'annual'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN plan_status text NOT NULL DEFAULT 'active'
      CHECK (plan_status IN ('active', 'past_due', 'canceled'));
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ai_credits_used INTEGER NOT NULL DEFAULT 0;

-- Unlimited access (migration 012)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unlimited_ai_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_granted_by_code TEXT;

-- Brief delivery prefs (migration 023)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brief_delivery_days SMALLINT[] NOT NULL DEFAULT '{1}',
  ADD COLUMN IF NOT EXISTS brief_delivery_hour SMALLINT NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS brief_delivery_tz TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS brief_last_enqueued_for_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_brief_delivery_hour_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_brief_delivery_hour_valid
      CHECK (brief_delivery_hour >= 0 AND brief_delivery_hour <= 23);
  END IF;
END $$;

-- Token wallet (migration 030)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_balance INTEGER NOT NULL DEFAULT 30;


-- ─── 2. SENDERS — ensure default is 'approved' ─────────────────────────────

ALTER TABLE public.senders ALTER COLUMN status SET DEFAULT 'approved';


-- ─── 3. ISSUES — ensure signal columns exist (migration 013) ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'signal_tier'
  ) THEN
    ALTER TABLE public.issues ADD COLUMN signal_tier text NOT NULL DEFAULT 'unclassified'
      CHECK (signal_tier IN ('high_signal', 'news', 'reference', 'unclassified'));
  END IF;
END $$;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS signal_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_issues_user_signal_tier
  ON public.issues(user_id, signal_tier);

-- Soft delete (migration 008)
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_issues_user_deleted_at
  ON public.issues(user_id, deleted_at);


-- ─── 4. HIGHLIGHTS table (migration 005) ────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  highlighted_text TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_issue_id ON public.highlights(issue_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_issue ON public.highlights(user_id, issue_id);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own highlights" ON public.highlights;
CREATE POLICY "Users can read own highlights"
  ON public.highlights FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own highlights" ON public.highlights;
CREATE POLICY "Users can insert own highlights"
  ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own highlights" ON public.highlights;
CREATE POLICY "Users can update own highlights"
  ON public.highlights FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own highlights" ON public.highlights;
CREATE POLICY "Users can delete own highlights"
  ON public.highlights FOR DELETE USING (auth.uid() = user_id);


-- ─── 5. DELETED_ISSUES table (migration 006) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deleted_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_issues_user_message_id
  ON public.deleted_issues(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_deleted_issues_user_id
  ON public.deleted_issues(user_id);

ALTER TABLE public.deleted_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can read own deleted issues"
  ON public.deleted_issues FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can insert own deleted issues"
  ON public.deleted_issues FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own deleted issues" ON public.deleted_issues;
CREATE POLICY "Users can delete own deleted issues"
  ON public.deleted_issues FOR DELETE USING (auth.uid() = user_id);


-- ─── 6. ISSUE_AUDIO_CACHE table (migration 009) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.issue_audio_cache (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready',
  mime_type TEXT,
  audio_base64 TEXT,
  provider TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);

ALTER TABLE public.issue_audio_cache
  ADD COLUMN IF NOT EXISTS credits_charged INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_charged_at TIMESTAMPTZ;

ALTER TABLE public.issue_audio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cached issue audio" ON public.issue_audio_cache;
CREATE POLICY "Users can read own cached issue audio"
  ON public.issue_audio_cache FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own cached issue audio" ON public.issue_audio_cache;
CREATE POLICY "Users can upsert own cached issue audio"
  ON public.issue_audio_cache FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cached issue audio" ON public.issue_audio_cache;
CREATE POLICY "Users can update own cached issue audio"
  ON public.issue_audio_cache FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 7. WEEKLY_BRIEFS table (migration 014) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overview TEXT NOT NULL,
  themes JSONB NOT NULL,
  source_issue_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_briefs_user_created_idx
  ON public.weekly_briefs(user_id, created_at DESC);

ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own weekly briefs" ON public.weekly_briefs;
CREATE POLICY "Users can view their own weekly briefs"
  ON public.weekly_briefs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own weekly briefs" ON public.weekly_briefs;
CREATE POLICY "Users can insert their own weekly briefs"
  ON public.weekly_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- delivery_key from migration 023
ALTER TABLE public.weekly_briefs
  ADD COLUMN IF NOT EXISTS delivery_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_briefs_user_delivery_key_idx
  ON public.weekly_briefs (user_id, delivery_key)
  WHERE delivery_key IS NOT NULL;


-- ─── 8. USER_ISSUE_EVENTS table (migration 016) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_issue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
  sender_email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'issue_opened', 'tldr_generated', 'listen_started', 'listen_completed',
    'highlight_created', 'note_created', 'issue_archived', 'issue_deleted'
  )),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_issue_events_user_created_idx
  ON public.user_issue_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_issue_events_user_sender_idx
  ON public.user_issue_events(user_id, sender_email);

ALTER TABLE public.user_issue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own issue events" ON public.user_issue_events;
CREATE POLICY "Users can insert their own issue events"
  ON public.user_issue_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own issue events" ON public.user_issue_events;
CREATE POLICY "Users can view their own issue events"
  ON public.user_issue_events FOR SELECT USING (auth.uid() = user_id);

-- Add missing DELETE policy (needed for account delete)
DROP POLICY IF EXISTS "Users can delete their own issue events" ON public.user_issue_events;
CREATE POLICY "Users can delete their own issue events"
  ON public.user_issue_events FOR DELETE USING (auth.uid() = user_id);


-- ─── 9. USER_ARTICLE_FEEDBACK table (migration 021) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.user_article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  sender_email TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('not_relevant')),
  auto_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_article_feedback_user_created_at
  ON public.user_article_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_article_feedback_user_sender
  ON public.user_article_feedback (user_id, sender_email);
CREATE INDEX IF NOT EXISTS idx_user_article_feedback_auto_tags
  ON public.user_article_feedback USING GIN (auto_tags);

ALTER TABLE public.user_article_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own article feedback" ON public.user_article_feedback;
CREATE POLICY "Users can insert own article feedback"
  ON public.user_article_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own article feedback" ON public.user_article_feedback;
CREATE POLICY "Users can read own article feedback"
  ON public.user_article_feedback FOR SELECT USING (auth.uid() = user_id);

-- Add missing DELETE policy (needed for account delete)
DROP POLICY IF EXISTS "Users can delete own article feedback" ON public.user_article_feedback;
CREATE POLICY "Users can delete own article feedback"
  ON public.user_article_feedback FOR DELETE USING (auth.uid() = user_id);


-- ─── 10. ACCESS_CODES & REDEMPTIONS (migration 012) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.access_codes (
  code TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT true,
  plan_tier TEXT NOT NULL DEFAULT 'elite' CHECK (plan_tier IN ('free', 'pro', 'elite')),
  unlimited_ai_access BOOLEAN NOT NULL DEFAULT true,
  max_redemptions INTEGER,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_code_redemptions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES public.access_codes(code) ON DELETE RESTRICT,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own redemptions" ON public.profile_code_redemptions;
CREATE POLICY "Users can read own redemptions"
  ON public.profile_code_redemptions FOR SELECT USING (auth.uid() = user_id);


-- ─── 11. TOKEN TRANSACTIONS (migration 030) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'bonus', 'refund', 'signup')),
  description TEXT,
  stripe_session_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user
  ON public.token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_stripe
  ON public.token_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own transactions" ON public.token_transactions;
CREATE POLICY "Users can read own transactions"
  ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert transactions" ON public.token_transactions;
CREATE POLICY "Service role can insert transactions"
  ON public.token_transactions FOR INSERT WITH CHECK (TRUE);


-- ─── 12. DATABASE FUNCTIONS ──────────────────────────────────────────────────

-- consume_ai_credits (migration 011)
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
  SELECT p.plan_tier, p.ai_cycle_started_at, p.ai_credits_used
    INTO v_plan, v_cycle_started, v_used
  FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
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
  UPDATE public.profiles SET ai_cycle_started_at = v_cycle_started, ai_credits_used = v_used + p_credits WHERE id = p_user_id;
  RETURN QUERY SELECT true, GREATEST(v_limit - (v_used + p_credits), 0), v_limit, v_plan, v_reset_at, null::text;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer) TO authenticated;

-- spend_wallet_tokens (migration 030)
CREATE OR REPLACE FUNCTION spend_wallet_tokens(
  p_user_id UUID, p_tokens INTEGER, p_description TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, balance_after INTEGER, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER; v_new_balance INTEGER; v_unlimited BOOLEAN;
BEGIN
  SELECT unlimited_ai_access INTO v_unlimited FROM profiles WHERE id = p_user_id;
  IF v_unlimited = TRUE THEN RETURN QUERY SELECT TRUE, -1, NULL::TEXT; RETURN; END IF;
  SELECT token_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL THEN RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT; RETURN; END IF;
  IF v_current_balance < p_tokens THEN RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient tokens'::TEXT; RETURN; END IF;
  v_new_balance := v_current_balance - p_tokens;
  UPDATE profiles SET token_balance = v_new_balance WHERE id = p_user_id;
  INSERT INTO token_transactions (user_id, amount, type, description, balance_after) VALUES (p_user_id, -p_tokens, 'spend', p_description, v_new_balance);
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- credit_wallet_tokens (migration 030)
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
      SELECT token_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT TRUE, COALESCE(v_current_balance, 0), 'Already credited'::TEXT;
      RETURN;
    END IF;
  END IF;
  SELECT token_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL THEN RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT; RETURN; END IF;
  v_new_balance := v_current_balance + p_tokens;
  UPDATE profiles SET token_balance = v_new_balance WHERE id = p_user_id;
  INSERT INTO token_transactions (user_id, amount, type, description, stripe_session_id, balance_after) VALUES (p_user_id, p_tokens, p_type, p_description, p_stripe_session_id, v_new_balance);
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- redeem_access_code (migration 012)
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
  UPDATE public.profiles SET plan_tier = v_code.plan_tier, unlimited_ai_access = v_code.unlimited_ai_access, access_granted_by_code = p_code WHERE id = p_user_id;
  RETURN QUERY SELECT true, 'Code redeemed successfully'::text, v_code.plan_tier, v_code.unlimited_ai_access;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(uuid, text) TO authenticated;


-- ─── DONE ────────────────────────────────────────────────────────────────────
-- If you see no errors above, your schema is now fully reconciled.
-- You can safely run this script again — it's fully idempotent.
