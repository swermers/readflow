-- Add email digest preferences to profiles
-- Defaults: enabled, Monday at 9am Eastern
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_day integer DEFAULT 1; -- 0=Sun, 1=Mon, ..., 6=Sat
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_hour integer DEFAULT 9; -- Hour in local tz (0-23)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_tz text DEFAULT 'America/New_York';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_last_sent_date text; -- YYYY-MM-DD to prevent double sends
