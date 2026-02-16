UPDATE senders
SET status = 'approved'
WHERE status = 'pending';

ALTER TABLE senders
ALTER COLUMN status SET DEFAULT 'approved';
