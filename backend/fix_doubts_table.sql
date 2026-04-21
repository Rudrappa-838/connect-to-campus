-- Add missing columns to doubts table
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP;

-- Ensure status has a default value if not already set
ALTER TABLE doubts ALTER COLUMN status SET DEFAULT 'Pending';

-- Update any existing NULL statuses to 'Pending'
UPDATE doubts SET status = 'Pending' WHERE status IS NULL;
