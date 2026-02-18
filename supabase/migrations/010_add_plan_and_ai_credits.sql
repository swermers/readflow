ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free'
  CHECK (plan_tier IN ('free', 'pro', 'elite')),
ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly'
  CHECK (billing_cycle IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active'
  CHECK (plan_status IN ('active', 'past_due', 'canceled')),
ADD COLUMN IF NOT EXISTS ai_cycle_started_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS ai_credits_used integer NOT NULL DEFAULT 0;
