-- 1. Add notify_likes to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS notify_likes boolean DEFAULT true;

-- 2. Create member_interests table
CREATE TABLE IF NOT EXISTS public.member_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  interested_in_user_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  icebreaker_message text,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, interested_in_user_id)
);

-- 3. Enable RLS on member_interests
ALTER TABLE public.member_interests ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for member_interests
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can see interests related to them') THEN
        CREATE POLICY "Users can see interests related to them"
        ON public.member_interests FOR SELECT
        USING (auth.uid() = user_id OR auth.uid() = interested_in_user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own interests') THEN
        CREATE POLICY "Users can insert their own interests"
        ON public.member_interests FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own interests') THEN
        CREATE POLICY "Users can delete their own interests"
        ON public.member_interests FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Ensure unique constraint on push_notification_log for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'push_notification_log_user_id_notification_type_key'
    ) THEN
        ALTER TABLE public.push_notification_log 
        ADD CONSTRAINT push_notification_log_user_id_notification_type_key 
        UNIQUE (user_id, notification_type);
    END IF;
END $$;