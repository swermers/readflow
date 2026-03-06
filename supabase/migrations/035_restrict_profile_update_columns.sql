-- Restrict the profiles UPDATE RLS policy so that users can only modify
-- safe, non-sensitive columns.  Previously the policy allowed updating ANY
-- column on the user's own row, which meant a crafted Supabase client call
-- (bypassing the API allowlist) could set token_balance, plan_tier,
-- unlimited_ai_access, etc.
--
-- This migration replaces the permissive UPDATE policy with one that uses a
-- USING + WITH CHECK clause ensuring sensitive columns cannot be changed.

-- Drop the old unrestricted policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a restricted policy: users can update their own row, but only if
-- sensitive columns remain unchanged.
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure sensitive fields are not modified by comparing against the
    -- current stored values via a subquery.
    AND token_balance = (SELECT p.token_balance FROM profiles p WHERE p.id = auth.uid())
    AND plan_tier = (SELECT p.plan_tier FROM profiles p WHERE p.id = auth.uid())
    AND plan_status = (SELECT p.plan_status FROM profiles p WHERE p.id = auth.uid())
    AND unlimited_ai_access = (SELECT p.unlimited_ai_access FROM profiles p WHERE p.id = auth.uid())
    AND access_granted_by_code = (SELECT p.access_granted_by_code FROM profiles p WHERE p.id = auth.uid())
    AND ai_credits_used = (SELECT p.ai_credits_used FROM profiles p WHERE p.id = auth.uid())
    AND ai_tokens_used = (SELECT p.ai_tokens_used FROM profiles p WHERE p.id = auth.uid())
    AND ai_cycle_started_at = (SELECT p.ai_cycle_started_at FROM profiles p WHERE p.id = auth.uid())
    AND billing_cycle = (SELECT p.billing_cycle FROM profiles p WHERE p.id = auth.uid())
    AND gmail_access_token = (SELECT p.gmail_access_token FROM profiles p WHERE p.id = auth.uid())
    AND gmail_refresh_token = (SELECT p.gmail_refresh_token FROM profiles p WHERE p.id = auth.uid())
    AND gmail_token_expires_at = (SELECT p.gmail_token_expires_at FROM profiles p WHERE p.id = auth.uid())
  );
