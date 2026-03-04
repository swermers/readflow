-- Add 'queued' (read-later) status to issues
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('unread', 'read', 'archived', 'queued'));
