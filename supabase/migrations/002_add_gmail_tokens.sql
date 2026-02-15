-- Add Gmail API token columns to profiles
-- Run after 001_initial_schema.sql

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gmail_last_sync_at TIMESTAMPTZ;
