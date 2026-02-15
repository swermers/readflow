-- Readflow Initial Schema
-- Run against your Supabase project's SQL editor

-- ─── PROFILES ───────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific fields

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  forwarding_alias TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_forwarding_alias
  ON profiles(forwarding_alias);

-- RLS: users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ─── SENDERS ────────────────────────────────────────────────────────────────
-- Newsletter senders. Each user has their own set.

CREATE TABLE IF NOT EXISTS senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'blocked')),
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_senders_user_id ON senders(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_senders_user_email ON senders(user_id, email);

-- RLS: users can only access their own senders
ALTER TABLE senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own senders"
  ON senders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own senders"
  ON senders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own senders"
  ON senders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own senders"
  ON senders FOR DELETE
  USING (auth.uid() = user_id);


-- ─── ISSUES ─────────────────────────────────────────────────────────────────
-- Individual newsletter emails (issues/editions)

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '(No Subject)',
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  from_email TEXT,
  message_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread', 'read', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_sender_id ON issues(sender_id);
CREATE INDEX IF NOT EXISTS idx_issues_user_status ON issues(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_user_message_id ON issues(user_id, message_id);

-- RLS: users can only access their own issues
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own issues"
  ON issues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issues"
  ON issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issues"
  ON issues FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own issues"
  ON issues FOR DELETE
  USING (auth.uid() = user_id);


-- ─── SERVICE ROLE BYPASS ────────────────────────────────────────────────────
-- The receive-email Edge Function uses the service role key,
-- which bypasses RLS automatically. No extra policies needed.
