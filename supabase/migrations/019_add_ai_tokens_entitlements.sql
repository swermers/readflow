ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_tokens_used integer NOT NULL DEFAULT 0;

UPDATE public.profiles
SET ai_tokens_used = GREATEST(COALESCE(ai_tokens_used, 0), COALESCE(ai_credits_used, 0) * 10);

CREATE OR REPLACE FUNCTION public.consume_ai_tokens(
  p_user_id uuid,
  p_tokens integer
)
RETURNS TABLE (
  success boolean,
  available integer,
  token_limit integer,
  plan_tier text,
  reset_at timestamptz,
  reason text,
  required integer
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
  IF p_tokens <= 0 THEN
    RETURN QUERY SELECT true, 0, 0, 'free'::text, v_now, null::text, p_tokens;
    RETURN;
  END IF;

  SELECT p.plan_tier, p.ai_cycle_started_at, p.ai_tokens_used
    INTO v_plan, v_cycle_started, v_used
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'free'::text, v_now, 'Profile not found'::text, p_tokens;
    RETURN;
  END IF;

  IF v_plan NOT IN ('free', 'pro', 'elite') THEN
    v_plan := 'free';
  END IF;

  v_limit := CASE v_plan
    WHEN 'elite' THEN 1000
    WHEN 'pro' THEN 500
    ELSE 30
  END;

  IF v_cycle_started IS NULL OR v_cycle_started < (v_now - interval '30 days') THEN
    v_cycle_started := v_now;
    v_used := 0;
  END IF;

  v_used := COALESCE(v_used, 0);
  v_reset_at := v_cycle_started + interval '30 days';

  IF (v_used + p_tokens) > v_limit THEN
    RETURN QUERY SELECT false, GREATEST(v_limit - v_used, 0), v_limit, v_plan, v_reset_at, 'Insufficient credits'::text, p_tokens;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET ai_cycle_started_at = v_cycle_started,
      ai_tokens_used = v_used + p_tokens,
      ai_credits_used = FLOOR((v_used + p_tokens) / 10.0)::integer
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, GREATEST(v_limit - (v_used + p_tokens), 0), v_limit, v_plan, v_reset_at, null::text, p_tokens;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_tokens(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, integer) TO authenticated;
