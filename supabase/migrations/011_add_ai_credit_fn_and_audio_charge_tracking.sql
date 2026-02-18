ALTER TABLE public.issue_audio_cache
ADD COLUMN IF NOT EXISTS credits_charged integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_charged_at timestamptz;

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_user_id uuid,
  p_credits integer
)
RETURNS TABLE (
  success boolean,
  remaining integer,
  credit_limit integer,
  plan_tier text,
  reset_at timestamptz,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_cycle_started timestamptz;
  v_used integer;
  v_limit integer;
  v_now timestamptz := now();
  v_reset_at timestamptz;
BEGIN
  IF p_credits <= 0 THEN
    RETURN QUERY SELECT true, 0, 0, 'free'::text, v_now, null::text;
    RETURN;
  END IF;

  SELECT p.plan_tier, p.ai_cycle_started_at, p.ai_credits_used
    INTO v_plan, v_cycle_started, v_used
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'free'::text, v_now, 'Profile not found'::text;
    RETURN;
  END IF;

  IF v_plan NOT IN ('free', 'pro', 'elite') THEN
    v_plan := 'free';
  END IF;

  v_limit := CASE v_plan
    WHEN 'elite' THEN 300
    WHEN 'pro' THEN 50
    ELSE 3
  END;

  IF v_cycle_started IS NULL OR v_cycle_started < (v_now - interval '30 days') THEN
    v_cycle_started := v_now;
    v_used := 0;
  END IF;

  v_used := COALESCE(v_used, 0);
  v_reset_at := v_cycle_started + interval '30 days';

  IF (v_used + p_credits) > v_limit THEN
    RETURN QUERY SELECT false, GREATEST(v_limit - v_used, 0), v_limit, v_plan, v_reset_at, 'Monthly AI credit limit reached'::text;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET ai_cycle_started_at = v_cycle_started,
      ai_credits_used = v_used + p_credits
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, GREATEST(v_limit - (v_used + p_credits), 0), v_limit, v_plan, v_reset_at, null::text;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer) TO authenticated;
