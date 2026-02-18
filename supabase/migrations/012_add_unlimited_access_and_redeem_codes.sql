ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unlimited_ai_access boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS access_granted_by_code text;

CREATE TABLE IF NOT EXISTS public.access_codes (
  code text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  plan_tier text NOT NULL DEFAULT 'elite' CHECK (plan_tier IN ('free', 'pro', 'elite')),
  unlimited_ai_access boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  redeemed_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_code_redemptions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES public.access_codes(code) ON DELETE RESTRICT,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own redemptions" ON public.profile_code_redemptions;
CREATE POLICY "Users can read own redemptions"
  ON public.profile_code_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_access_code(
  p_user_id uuid,
  p_code text
)
RETURNS TABLE (
  success boolean,
  message text,
  plan_tier text,
  unlimited_ai_access boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code
  FROM public.access_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid invite code'::text, 'free'::text, false;
    RETURN;
  END IF;

  IF NOT v_code.active THEN
    RETURN QUERY SELECT false, 'Invite code is inactive'::text, 'free'::text, false;
    RETURN;
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN QUERY SELECT false, 'Invite code has expired'::text, 'free'::text, false;
    RETURN;
  END IF;

  IF v_code.max_redemptions IS NOT NULL AND v_code.redeemed_count >= v_code.max_redemptions THEN
    RETURN QUERY SELECT false, 'Invite code redemption limit reached'::text, 'free'::text, false;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profile_code_redemptions r
    WHERE r.user_id = p_user_id AND r.code = p_code
  ) THEN
    RETURN QUERY SELECT true, 'Code already redeemed'::text, v_code.plan_tier, v_code.unlimited_ai_access;
    RETURN;
  END IF;

  INSERT INTO public.profile_code_redemptions (user_id, code)
  VALUES (p_user_id, p_code);

  UPDATE public.access_codes
  SET redeemed_count = redeemed_count + 1
  WHERE code = p_code;

  UPDATE public.profiles
  SET plan_tier = v_code.plan_tier,
      unlimited_ai_access = v_code.unlimited_ai_access,
      access_granted_by_code = p_code
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, 'Code redeemed successfully'::text, v_code.plan_tier, v_code.unlimited_ai_access;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(uuid, text) TO authenticated;
