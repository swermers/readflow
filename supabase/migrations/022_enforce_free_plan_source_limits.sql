CREATE OR REPLACE FUNCTION public.enforce_free_plan_source_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_current_approved integer;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(plan_tier, 'free')
    INTO v_plan
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF COALESCE(v_plan, 'free') <> 'free' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_current_approved
  FROM public.senders
  WHERE user_id = NEW.user_id
    AND status = 'approved'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_current_approved >= 5 THEN
    RAISE EXCEPTION 'Free plan supports up to 5 active sources.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_plan_source_limit_on_senders ON public.senders;

CREATE TRIGGER enforce_free_plan_source_limit_on_senders
BEFORE INSERT OR UPDATE OF status ON public.senders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_source_limit();
