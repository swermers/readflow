-- Add selected Gmail label IDs for syncing
-- Run after 002_add_gmail_tokens.sql

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gmail_sync_labels TEXT[] DEFAULT '{}';
