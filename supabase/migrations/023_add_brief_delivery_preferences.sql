ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brief_delivery_days smallint[] NOT NULL DEFAULT '{1}',
  ADD COLUMN IF NOT EXISTS brief_delivery_hour smallint NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS brief_delivery_tz text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS brief_last_enqueued_for_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_brief_delivery_hour_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_brief_delivery_hour_valid
      CHECK (brief_delivery_hour >= 0 AND brief_delivery_hour <= 23);
  END IF;
END $$;

ALTER TABLE public.weekly_briefs
  ADD COLUMN IF NOT EXISTS delivery_key text;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_briefs_user_delivery_key_idx
  ON public.weekly_briefs (user_id, delivery_key)
  WHERE delivery_key IS NOT NULL;
