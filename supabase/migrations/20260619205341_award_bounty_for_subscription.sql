begin;

drop function if exists public.award_bounty_for_subscription(uuid, text, text, boolean);

create function public.award_bounty_for_subscription(
  p_male_id uuid,
  p_tier text,
  p_stripe_subscription_id text,
  p_is_renewal boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_female_id uuid;
  v_amount_minutes integer;
  v_source text;
  v_last_streak_time timestamptz;
  v_subs_since_last_streak integer;
  v_streak_awarded boolean := false;
  v_streak_amount integer := 0;
  v_result jsonb;
begin
  -- Find the latest active attribution for this male user
  select female_id into v_female_id
  from public.bounty_attributions
  where male_id = p_male_id
    and expires_at >= now()
  order by last_interaction_at desc
  limit 1;

  -- If no active attribution, return success: false
  if v_female_id is null then
    return jsonb_build_object('success', false);
  end if;

  -- Set source based on renewal status and tier
  if p_is_renewal then
    v_source := 'renewal';
  else
    if lower(p_tier) like '%premium%' then
      v_source := 'premium';
    else
      v_source := 'basic';
    end if;
  end if;

  -- Calculate minutes based on tier/renewal/streak.
  if v_source = 'renewal' then
    v_amount_minutes := 200;
  elsif v_source = 'premium' then
    v_amount_minutes := 500;
  else
    v_amount_minutes := 125;
  end if;

  -- Check if this bounty has already been credited (idempotency)
  if exists (
    select 1
    from public.bounty_earnings
    where female_id = v_female_id
      and male_id = p_male_id
      and stripe_subscription_id = p_stripe_subscription_id
      and source = v_source
  ) then
    return jsonb_build_object('success', false);
  end if;

  -- Insert into bounty_earnings
  insert into public.bounty_earnings (
    female_id,
    male_id,
    amount_minutes,
    source,
    stripe_subscription_id,
    paid_out,
    clawed_back,
    created_at
  )
  values (
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
  update public.member_minutes
  set gifted_minutes = coalesce(gifted_minutes, 0) + v_amount_minutes,
      updated_at = now()
  where user_id = v_female_id;

  -- Check for streak bonus (3 in 7 days): +500 min bonus
  select coalesce(max(created_at), '1970-01-01'::timestamptz)
  into v_last_streak_time
  from public.bounty_earnings
  where female_id = v_female_id
    and source = 'streak';

  select count(*)
  into v_subs_since_last_streak
  from public.bounty_earnings
  where female_id = v_female_id
    and source in ('basic', 'premium', 'renewal')
    and created_at > v_last_streak_time
    and created_at >= now() - interval '7 days';

  if v_subs_since_last_streak >= 3 then
    if not exists (
      select 1
      from public.bounty_earnings
      where female_id = v_female_id
        and male_id = p_male_id
        and stripe_subscription_id = p_stripe_subscription_id
        and source = 'streak'
    ) then
      insert into public.bounty_earnings (
        female_id,
        male_id,
        amount_minutes,
        source,
        stripe_subscription_id,
        paid_out,
        clawed_back,
        created_at
      )
      values (
        v_female_id,
        p_male_id,
        500,
        'streak',
        p_stripe_subscription_id,
        false,
        false,
        now()
      );

      update public.member_minutes
      set gifted_minutes = coalesce(gifted_minutes, 0) + 500,
          updated_at = now()
      where user_id = v_female_id;

      v_streak_awarded := true;
      v_streak_amount := 500;
    end if;
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'female_id', v_female_id::text,
    'male_id', p_male_id::text,
    'amount_minutes', v_amount_minutes,
    'source', v_source,
    'streak_awarded', v_streak_awarded,
    'streak_amount', v_streak_amount
  );

  return v_result;
end;
$$;

alter function public.award_bounty_for_subscription(uuid, text, text, boolean) owner to postgres;
revoke all on function public.award_bounty_for_subscription(uuid, text, text, boolean) from public, anon;
grant execute on function public.award_bounty_for_subscription(uuid, text, text, boolean) to authenticated, service_role;

commit;