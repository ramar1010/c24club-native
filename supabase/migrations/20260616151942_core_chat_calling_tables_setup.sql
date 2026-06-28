-- Core chat/calling tables setup (if missing)
-- 1. Create conversations table if not exists
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  participant_2 uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can select conversations they are a participant in') THEN
        CREATE POLICY "Users can select conversations they are a participant in"
        ON public.conversations FOR SELECT
        USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert conversations they are a participant in') THEN
        CREATE POLICY "Users can insert conversations they are a participant in"
        ON public.conversations FOR INSERT
        WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
    END IF;
END $$;

REVOKE ALL ON public.conversations FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated, service_role;


-- 2. Create dm_messages table if not exists
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can select messages in conversations they participate in') THEN
        CREATE POLICY "Users can select messages in conversations they participate in"
        ON public.dm_messages FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert messages in conversations they participate in') THEN
        CREATE POLICY "Users can insert messages in conversations they participate in"
        ON public.dm_messages FOR INSERT
        WITH CHECK (
          auth.uid() = sender_id AND
          EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
          )
        );
    END IF;
END $$;

REVOKE ALL ON public.dm_messages FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_messages TO authenticated, service_role;


-- 3. Create direct_call_invites table if not exists
CREATE TABLE IF NOT EXISTS public.direct_call_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  invitee_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.direct_call_invites ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can select invites they participate in') THEN
        CREATE POLICY "Users can select invites they participate in"
        ON public.direct_call_invites FOR SELECT
        USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert invites they participate in') THEN
        CREATE POLICY "Users can insert invites they participate in"
        ON public.direct_call_invites FOR INSERT
        WITH CHECK (auth.uid() = inviter_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update invites they participate in') THEN
        CREATE POLICY "Users can update invites they participate in"
        ON public.direct_call_invites FOR UPDATE
        USING (auth.uid() = inviter_id OR auth.uid() = invitee_id)
        WITH CHECK (auth.uid() = inviter_id OR auth.uid() = invitee_id);
    END IF;
END $$;

REVOKE ALL ON public.direct_call_invites FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_call_invites TO authenticated, service_role;


-- 4. Create room_signals table if not exists
CREATE TABLE IF NOT EXISTS public.room_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_channel text NOT NULL,
  signal_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.room_signals ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all authenticated users to select/insert room_signals') THEN
        CREATE POLICY "Allow all authenticated users to select/insert room_signals"
        ON public.room_signals FOR ALL
        USING (auth.role() = 'authenticated')
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

REVOKE ALL ON public.room_signals FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_signals TO authenticated, service_role;


-- 5. Create rooms table if not exists
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member1 uuid REFERENCES public.members(id) ON DELETE CASCADE,
  member2 uuid REFERENCES public.members(id) ON DELETE CASCADE,
  channel1 text,
  channel2 text,
  member1_gender text,
  member2_gender text,
  member1_voice_mode boolean DEFAULT false,
  member2_voice_mode boolean DEFAULT false,
  status text DEFAULT 'connected',
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can select rooms they are in') THEN
        CREATE POLICY "Users can select rooms they are in"
        ON public.rooms FOR SELECT
        USING (auth.uid() = member1 OR auth.uid() = member2);
    END IF;
END $$;

REVOKE ALL ON public.rooms FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated, service_role;


-- 6. Create waiting_queue table if not exists
CREATE TABLE IF NOT EXISTS public.waiting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE UNIQUE NOT NULL,
  channel_id text NOT NULL,
  member_gender text,
  voice_mode boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all authenticated users to manage waiting_queue') THEN
        CREATE POLICY "Allow all authenticated users to manage waiting_queue"
        ON public.waiting_queue FOR ALL
        USING (auth.role() = 'authenticated')
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

REVOKE ALL ON public.waiting_queue FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_queue TO authenticated, service_role;


-- 7. Create bounty_attributions table
CREATE TABLE IF NOT EXISTS public.bounty_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  male_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  female_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interaction_type text CHECK (interaction_type IN ('dm', 'call')) NOT NULL,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(male_id, female_id)
);

ALTER TABLE public.bounty_attributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can see their own bounty links') THEN
        CREATE POLICY "Users can see their own bounty links"
        ON public.bounty_attributions FOR SELECT
        USING (auth.uid() = female_id OR auth.uid() = male_id);
    END IF;
END $$;

REVOKE ALL ON public.bounty_attributions FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounty_attributions TO authenticated, service_role;


-- 8. Create bounty_earnings table
CREATE TABLE IF NOT EXISTS public.bounty_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  female_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  male_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_minutes integer NOT NULL,
  source text CHECK (source IN ('basic', 'premium', 'renewal', 'streak')) NOT NULL,
  stripe_subscription_id text NOT NULL,
  paid_out boolean DEFAULT false NOT NULL,
  clawed_back boolean DEFAULT false NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (female_id, male_id, stripe_subscription_id, source)
);

ALTER TABLE public.bounty_earnings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Females can see their own bounty earnings') THEN
        CREATE POLICY "Females can see their own bounty earnings"
        ON public.bounty_earnings FOR SELECT
        USING (auth.uid() = female_id);
    END IF;
END $$;

REVOKE ALL ON public.bounty_earnings FROM public, anon;
GRANT SELECT ON public.bounty_earnings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounty_earnings TO service_role;


-- 9. Implement record_bounty_interaction RPC
CREATE OR REPLACE FUNCTION public.record_bounty_interaction(
  p_male_id uuid,
  p_interaction_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_female_id uuid;
  v_female_gender text;
  v_male_gender text;
  v_is_vip boolean;
BEGIN
  -- Get caller ID
  v_female_id := auth.uid();
  IF v_female_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is Female
  SELECT gender INTO v_female_gender FROM public.members WHERE id = v_female_id;
  IF v_female_gender IS NULL OR NOT (v_female_gender ILIKE 'female') THEN
    RAISE EXCEPTION 'Caller must be female';
  END IF;

  -- Verify p_male_id is Male
  SELECT gender INTO v_male_gender FROM public.members WHERE id = p_male_id;
  IF v_male_gender IS NULL OR NOT (v_male_gender ILIKE 'male') THEN
    RAISE EXCEPTION 'Target user must be male';
  END IF;

  -- Skip if male is already VIP
  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false) INTO v_is_vip 
  FROM public.member_minutes 
  WHERE user_id = p_male_id;
  
  IF v_is_vip THEN
    RETURN FALSE;
  END IF;

  -- Upsert attribution
  INSERT INTO public.bounty_attributions (
    male_id,
    female_id,
    interaction_type,
    last_interaction_at,
    expires_at
  )
  VALUES (
    p_male_id,
    v_female_id,
    p_interaction_type,
    now(),
    now() + INTERVAL '7 days'
  )
  ON CONFLICT (male_id, female_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    last_interaction_at = EXCLUDED.last_interaction_at,
    expires_at = EXCLUDED.expires_at;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_bounty_interaction(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_bounty_interaction(uuid, text) TO authenticated, service_role;


-- 10. Implement award_bounty_for_subscription RPC
CREATE OR REPLACE FUNCTION public.award_bounty_for_subscription(
  p_male_id uuid,
  p_tier text,
  p_stripe_subscription_id text,
  p_is_renewal boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_female_id uuid;
  v_amount_minutes integer;
  v_source text;
BEGIN
  -- Find the latest active attribution for this male user
  SELECT female_id INTO v_female_id
  FROM public.bounty_attributions
  WHERE male_id = p_male_id AND expires_at >= now()
  ORDER BY last_interaction_at DESC
  LIMIT 1;

  -- If no active attribution, do nothing and return false
  IF v_female_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Set source based on renewal status and tier
  IF p_is_renewal THEN
    v_source := 'renewal';
  ELSE
    IF lower(p_tier) LIKE '%premium%' THEN
      v_source := 'premium';
    ELSE
      v_source := 'basic';
    END IF;
  END IF;

  -- Calculate minutes based on tier/renewal/streak
  -- Basic: 50 minutes. Premium: 150 minutes. Renewal: 100 minutes.
  IF v_source = 'renewal' THEN
    v_amount_minutes := 100;
  ELSIF v_source = 'premium' THEN
    v_amount_minutes := 150;
  ELSE
    v_amount_minutes := 50;
  END IF;

  -- Check if this bounty has already been credited (idempotency)
  IF EXISTS (
    SELECT 1 FROM public.bounty_earnings
    WHERE female_id = v_female_id
      AND male_id = p_male_id
      AND stripe_subscription_id = p_stripe_subscription_id
      AND source = v_source
  ) THEN
    RETURN FALSE;
  END IF;

  -- Insert into bounty_earnings
  INSERT INTO public.bounty_earnings (
    female_id,
    male_id,
    amount_minutes,
    source,
    stripe_subscription_id,
    paid_out,
    clawed_back,
    created_at
  )
  VALUES (
    v_female_id,
    p_male_id,
    v_amount_minutes,
    v_source,
    p_stripe_subscription_id,
    false,
    false,
    now()
  );

  -- Increment member_minutes.gifted_minutes for the female
  UPDATE public.member_minutes
  SET gifted_minutes = COALESCE(gifted_minutes, 0) + v_amount_minutes,
      updated_at = now()
  WHERE user_id = v_female_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) TO authenticated, service_role;


-- 11. Implement get_bounty_summary RPC
CREATE OR REPLACE FUNCTION public.get_bounty_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_female_id uuid;
  v_total_minutes integer;
  v_rate_per_minute numeric;
  v_total_usd numeric;
  v_active_links integer;
  v_recent_logs jsonb;
  v_result jsonb;
BEGIN
  -- Get caller ID
  v_female_id := auth.uid();
  IF v_female_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate total minutes
  SELECT COALESCE(SUM(amount_minutes), 0)
  INTO v_total_minutes
  FROM public.bounty_earnings
  WHERE female_id = v_female_id AND clawed_back = false;

  -- Load the current cashout rate, falling back to 0.005 if missing
  SELECT rate_per_minute
  INTO v_rate_per_minute
  FROM public.cashout_settings
  WHERE id = 1
  LIMIT 1;

  v_rate_per_minute := COALESCE(v_rate_per_minute, 0.005);

  -- Calculate total USD using cashout_settings.rate_per_minute
  v_total_usd := v_total_minutes * v_rate_per_minute;

  -- Count active links
  SELECT COUNT(*)
  INTO v_active_links
  FROM public.bounty_attributions
  WHERE female_id = v_female_id AND expires_at >= now();

  -- Get recent logs (latest 5 logs)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_recent_logs
  FROM (
    SELECT 
      e.id,
      e.amount_minutes,
      e.source,
      e.created_at,
      e.paid_out,
      m.name as partner_name,
      m.image_url as partner_image_url
    FROM public.bounty_earnings e
    LEFT JOIN public.members m ON e.male_id = m.id
    WHERE e.female_id = v_female_id
    ORDER BY e.created_at DESC
    LIMIT 5
  ) t;

  -- Build result
  v_result := jsonb_build_object(
    'total_minutes_earned', v_total_minutes,
    'total_usd_earned', v_total_usd,
    'active_links_count', v_active_links,
    'recent_logs', v_recent_logs
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_bounty_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_bounty_summary() TO authenticated;


-- 12. Create handle_auto_record_bounty_from_dm trigger function
CREATE OR REPLACE FUNCTION public.handle_auto_record_bounty_from_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_participant_1 uuid;
  v_participant_2 uuid;
  v_receiver_id uuid;
  v_sender_gender text;
  v_receiver_gender text;
  v_male_id uuid;
  v_female_id uuid;
  v_is_vip boolean;
BEGIN
  -- Get conversation details
  SELECT participant_1, participant_2 
  INTO v_participant_1, v_participant_2
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_participant_1 IS NULL OR v_participant_2 IS NULL THEN
    RETURN NEW;
  END IF;

  -- Identify receiver
  IF NEW.sender_id = v_participant_1 THEN
    v_receiver_id := v_participant_2;
  ELSE
    v_receiver_id := v_participant_1;
  END IF;

  -- Get genders (case-insensitive checks)
  SELECT gender INTO v_sender_gender FROM public.members WHERE id = NEW.sender_id;
  SELECT gender INTO v_receiver_gender FROM public.members WHERE id = v_receiver_id;

  IF v_sender_gender IS NULL OR v_receiver_gender IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine who is male and who is female
  IF v_sender_gender ILIKE 'female' AND v_receiver_gender ILIKE 'male' THEN
    v_female_id := NEW.sender_id;
    v_male_id := v_receiver_id;
  ELSIF v_sender_gender ILIKE 'male' AND v_receiver_gender ILIKE 'female' THEN
    v_female_id := v_receiver_id;
    v_male_id := NEW.sender_id;
  ELSE
    -- Genders do not match female-male interaction
    RETURN NEW;
  END IF;

  -- Skip if male is already VIP
  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false) INTO v_is_vip
  FROM public.member_minutes
  WHERE user_id = v_male_id;

  IF v_is_vip THEN
    RETURN NEW;
  END IF;

  -- Upsert attribution
  INSERT INTO public.bounty_attributions (
    male_id,
    female_id,
    interaction_type,
    last_interaction_at,
    expires_at
  )
  VALUES (
    v_male_id,
    v_female_id,
    'dm',
    now(),
    now() + INTERVAL '7 days'
  )
  ON CONFLICT (male_id, female_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    last_interaction_at = EXCLUDED.last_interaction_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_record_bounty_from_dm_trigger ON public.dm_messages;
CREATE TRIGGER auto_record_bounty_from_dm_trigger
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_record_bounty_from_dm();


-- 13. Create handle_auto_record_bounty_from_call trigger function
CREATE OR REPLACE FUNCTION public.handle_auto_record_bounty_from_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inviter_gender text;
  v_invitee_gender text;
  v_male_id uuid;
  v_female_id uuid;
  v_is_vip boolean;
BEGIN
  -- Trigger logic should only run when the call is accepted or matched
  IF NEW.status NOT IN ('accepted', 'matched') THEN
    RETURN NEW;
  END IF;

  -- Get genders (case-insensitive checks)
  SELECT gender INTO v_inviter_gender FROM public.members WHERE id = NEW.inviter_id;
  SELECT gender INTO v_invitee_gender FROM public.members WHERE id = NEW.invitee_id;

  IF v_inviter_gender IS NULL OR v_invitee_gender IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine who is male and who is female
  IF v_inviter_gender ILIKE 'female' AND v_invitee_gender ILIKE 'male' THEN
    v_female_id := NEW.inviter_id;
    v_male_id := NEW.invitee_id;
  ELSIF v_inviter_gender ILIKE 'male' AND v_invitee_gender ILIKE 'female' THEN
    v_female_id := NEW.invitee_id;
    v_male_id := NEW.inviter_id;
  ELSE
    -- Genders do not match female-male interaction
    RETURN NEW;
  END IF;

  -- Skip if male is already VIP
  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false) INTO v_is_vip
  FROM public.member_minutes
  WHERE user_id = v_male_id;

  IF v_is_vip THEN
    RETURN NEW;
  END IF;

  -- Upsert attribution
  INSERT INTO public.bounty_attributions (
    male_id,
    female_id,
    interaction_type,
    last_interaction_at,
    expires_at
  )
  VALUES (
    v_male_id,
    v_female_id,
    'call',
    now(),
    now() + INTERVAL '7 days'
  )
  ON CONFLICT (male_id, female_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    last_interaction_at = EXCLUDED.last_interaction_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_record_bounty_from_call_trigger ON public.direct_call_invites;
CREATE TRIGGER auto_record_bounty_from_call_trigger
  AFTER INSERT OR UPDATE ON public.direct_call_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_record_bounty_from_call();


-- 14. Create handle_auto_record_bounty_from_rooms trigger function
CREATE OR REPLACE FUNCTION public.handle_auto_record_bounty_from_rooms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member1_gender text;
  v_member2_gender text;
  v_male_id uuid;
  v_female_id uuid;
  v_is_vip boolean;
BEGIN
  -- Get genders (case-insensitive checks)
  SELECT gender INTO v_member1_gender FROM public.members WHERE id = NEW.member1;
  SELECT gender INTO v_member2_gender FROM public.members WHERE id = NEW.member2;

  IF v_member1_gender IS NULL OR v_member2_gender IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine who is male and who is female
  IF v_member1_gender ILIKE 'female' AND v_member2_gender ILIKE 'male' THEN
    v_female_id := NEW.member1;
    v_male_id := NEW.member2;
  ELSIF v_member1_gender ILIKE 'male' AND v_member2_gender ILIKE 'female' THEN
    v_female_id := NEW.member2;
    v_male_id := NEW.member1;
  ELSE
    -- Genders do not match female-male interaction
    RETURN NEW;
  END IF;

  -- Skip if male is already VIP
  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false) INTO v_is_vip
  FROM public.member_minutes
  WHERE user_id = v_male_id;

  IF v_is_vip THEN
    RETURN NEW;
  END IF;

  -- Upsert attribution
  INSERT INTO public.bounty_attributions (
    male_id,
    female_id,
    interaction_type,
    last_interaction_at,
    expires_at
  )
  VALUES (
    v_male_id,
    v_female_id,
    'call',
    now(),
    now() + INTERVAL '7 days'
  )
  ON CONFLICT (male_id, female_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    last_interaction_at = EXCLUDED.last_interaction_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_record_bounty_from_rooms_trigger ON public.rooms;
CREATE TRIGGER auto_record_bounty_from_rooms_trigger
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_record_bounty_from_rooms();