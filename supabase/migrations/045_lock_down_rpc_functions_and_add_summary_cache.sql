-- Migration 045: lock down callable database functions + restore summary cache
-- ────────────────────────────────────────────────────────────────────────────
-- 1. These SECURITY DEFINER functions could be called by anyone through
--    /rest/v1/rpc, even signed out, for ANY user id. That let a caller add
--    tokens to their own wallet, spend negative tokens (which also adds), read
--    another user's newsletters via search, or queue and claim background jobs.
--
--    • Server-only (service role): credit_wallet_tokens, enqueue_background_job,
--      claim_background_jobs, and the unused consume_ai_tokens / consume_ai_credits.
--    • Signed-in users, but only for their own account: spend_wallet_tokens,
--      redeem_access_code, search_issues. The server (service role) can still
--      call them for any user.
--
-- 2. issue_summaries (migration 027) never reached the database, so TL;DR
--    summaries were regenerated on every open. Recreate it.
--
-- Only ReadFlow objects are touched. Sift's ke_* tables, functions and cron
-- jobs are not referenced here.

-- ─── Caller check ─────────────────────────────────────────────────────────
-- Raises unless the request comes from the server (service role or a direct
-- database connection) or from the signed-in user who owns p_user_id.
CREATE OR REPLACE FUNCTION public.rf_assert_caller_owns(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not allowed for this user' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rf_assert_caller_owns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rf_assert_caller_owns(uuid) TO authenticated, service_role;

-- ─── spend_wallet_tokens: own account only, positive amounts only ─────────
CREATE OR REPLACE FUNCTION public.spend_wallet_tokens(p_user_id uuid, p_tokens integer, p_description text DEFAULT NULL::text)
RETURNS TABLE(success boolean, balance_after integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER; v_new_balance INTEGER; v_unlimited BOOLEAN;
BEGIN
  PERFORM public.rf_assert_caller_owns(p_user_id);
  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Token amount must be positive'::TEXT; RETURN;
  END IF;
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

-- ─── redeem_access_code: own account only ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_user_id uuid, p_code text)
RETURNS TABLE(success boolean, message text, plan_tier text, unlimited_ai_access boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code public.access_codes%ROWTYPE;
BEGIN
  PERFORM public.rf_assert_caller_owns(p_user_id);
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

-- ─── search_issues: own account only ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_issues(p_user_id uuid, p_query text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, subject text, snippet text, from_email text, received_at timestamp with time zone, status text, sender_name text, rank real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsquery_val tsquery;
  safe_query text;
BEGIN
  PERFORM public.rf_assert_caller_owns(p_user_id);
  tsquery_val := websearch_to_tsquery('english', p_query);
  safe_query := '%' || lower(p_query) || '%';

  RETURN QUERY
  SELECT
    final.id, final.subject, final.snippet, final.from_email,
    final.received_at, final.status, final.sender_name, final.rank
  FROM (
    SELECT DISTINCT ON (combined.id)
      combined.id, combined.subject, combined.snippet, combined.from_email,
      combined.received_at, combined.status, combined.sender_name, combined.rank
    FROM (
      SELECT
        i.id, i.subject, i.snippet, i.from_email,
        i.received_at, i.status,
        s.name AS sender_name,
        ts_rank(i.search_vector, tsquery_val) AS rank
      FROM issues i
      LEFT JOIN senders s ON s.id = i.sender_id
      WHERE i.user_id = p_user_id
        AND i.deleted_at IS NULL
        AND i.search_vector @@ tsquery_val

      UNION ALL

      SELECT
        i.id, i.subject, i.snippet, i.from_email,
        i.received_at, i.status,
        s.name AS sender_name,
        0.5::real AS rank
      FROM issues i
      INNER JOIN senders s ON s.id = i.sender_id
      WHERE i.user_id = p_user_id
        AND i.deleted_at IS NULL
        AND lower(s.name) LIKE safe_query
    ) combined
    ORDER BY combined.id, combined.rank DESC
  ) final
  ORDER BY final.rank DESC, final.received_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────
-- Own-account functions: signed-in users + server.
REVOKE ALL ON FUNCTION public.spend_wallet_tokens(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_access_code(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_issues(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_wallet_tokens(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_issues(uuid, text, integer, integer) TO authenticated, service_role;

-- Server-only functions.
ALTER FUNCTION public.credit_wallet_tokens(uuid, integer, text, text, text) SET search_path = public;
ALTER FUNCTION public.enqueue_background_job(text, jsonb, text, integer) SET search_path = public;
ALTER FUNCTION public.claim_background_jobs(text, integer, text, integer) SET search_path = public;

REVOKE ALL ON FUNCTION public.credit_wallet_tokens(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_background_job(text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_background_jobs(text, integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_background_jobs(text, text, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_wallet_tokens(uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job(text, jsonb, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_background_job(text, text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, text, integer, integer) TO service_role;

-- ─── issue_summaries (from migration 027, never applied) ──────────────────
CREATE TABLE IF NOT EXISTS public.issue_summaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text NOT NULL,
  takeaways jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (issue_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_summaries_user_id ON public.issue_summaries(user_id);

ALTER TABLE public.issue_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own summaries" ON public.issue_summaries;
DROP POLICY IF EXISTS "Users can insert own summaries" ON public.issue_summaries;
DROP POLICY IF EXISTS "Users can update own summaries" ON public.issue_summaries;

CREATE POLICY "Users can read own summaries"
  ON public.issue_summaries FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own summaries"
  ON public.issue_summaries FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own summaries"
  ON public.issue_summaries FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
