-- Migration: Update bounty minute payouts and implement streak logic
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
  v_last_streak_time timestamptz;
  v_subs_since_last_streak integer;
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
  -- Basic: 75 minutes. Premium: 249 minutes. Renewal: 100 minutes.
  IF v_source = 'renewal' THEN
    v_amount_minutes := 100;
  ELSIF v_source = 'premium' THEN
    v_amount_minutes := 249;
  ELSE
    v_amount_minutes := 75;
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

  -- Check for Streak bonus (3 in 7 days): +500 min bonus
  -- 1. Find the timestamp of the last streak bonus awarded to this female
  SELECT COALESCE(MAX(created_at), '1970-01-01'::timestamptz) INTO v_last_streak_time
  FROM public.bounty_earnings
  WHERE female_id = v_female_id
    AND source = 'streak';

  -- 2. Count non-streak bounty earnings for this female since that last streak bonus and within last 7 days
  SELECT count(*) INTO v_subs_since_last_streak
  FROM public.bounty_earnings
  WHERE female_id = v_female_id
    AND source IN ('basic', 'premium', 'renewal')
    AND created_at > v_last_streak_time
    AND created_at >= now() - INTERVAL '7 days';

  -- 3. If count >= 3, award streak bonus
  IF v_subs_since_last_streak >= 3 THEN
    -- Check if streak bonus has already been credited for this specific subscription to ensure idempotency
    IF NOT EXISTS (
      SELECT 1 FROM public.bounty_earnings
      WHERE female_id = v_female_id
        AND male_id = p_male_id
        AND stripe_subscription_id = p_stripe_subscription_id
        AND source = 'streak'
    ) THEN
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
        500,
        'streak',
        p_stripe_subscription_id,
        false,
        false,
        now()
      );

      -- Increment member_minutes.gifted_minutes for the female by another 500
      UPDATE public.member_minutes
      SET gifted_minutes = COALESCE(gifted_minutes, 0) + 500,
          updated_at = now()
      WHERE user_id = v_female_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) TO authenticated, service_role;