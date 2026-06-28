-- Add columns to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS notify_female_searching boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS call_notify_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS male_search_notify_mode text DEFAULT 'every';

-- Create male_search_batch_log table
CREATE TABLE IF NOT EXISTS male_search_batch_log (
  female_user_id uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  join_count int DEFAULT 0,
  last_reset_at timestamptz DEFAULT now()
);

-- Enable RLS for male_search_batch_log
ALTER TABLE male_search_batch_log ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for male_search_batch_log (authenticated users can read their own)
CREATE POLICY "Users can view their own batch log" 
ON male_search_batch_log FOR SELECT 
USING (auth.uid() = female_user_id);

-- Create increment_male_search_count function
CREATE OR REPLACE FUNCTION increment_male_search_count(p_female_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO male_search_batch_log (female_user_id, join_count)
  VALUES (p_female_id, 1)
  ON CONFLICT (female_user_id)
  DO UPDATE SET join_count = male_search_batch_log.join_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;