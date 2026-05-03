-- Add NSFW strike count to members table for shadowban tracking
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS nsfw_strike_count integer NOT NULL DEFAULT 0;

-- Index for fast lookup (we'll query all users where count >= 1)
CREATE INDEX IF NOT EXISTS idx_members_nsfw_strike_count ON members(nsfw_strike_count);