-- Auto-approve all senders and change the default
-- The Gatekeeper is being removed — label selection is now the gate.
-- Run after 003_add_gmail_sync_labels.sql

UPDATE senders SET status = 'approved' WHERE status = 'pending';

ALTER TABLE senders ALTER COLUMN status SET DEFAULT 'approved';
