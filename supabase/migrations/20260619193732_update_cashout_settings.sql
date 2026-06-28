begin;

update public.cashout_settings
set rate_per_minute = 0.01,
    updated_at = now()
where id = 1;

create or replace function public.get_bounty_summary()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_female_id uuid;
  v_total_minutes integer;
  v_total_usd numeric;
  v_active_links integer;
  v_recent_logs jsonb;
  v_pending_logs jsonb;
  v_result jsonb;
begin
  -- Get caller ID
  v_female_id := auth.uid();
  if v_female_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Calculate total minutes
  select coalesce(sum(amount_minutes), 0)
  into v_total_minutes
  from public.bounty_earnings
  where female_id = v_female_id and clawed_back = false;

  -- Calculate total USD using a hardcoded rate of 0.01
  v_total_usd := v_total_minutes * 0.01;

  -- Count active links
  select count(*)
  into v_active_links
  from public.bounty_attributions
  where female_id = v_female_id and expires_at >= now();

  -- Get recent logs (latest 10 logs)
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_recent_logs
  from (
    select 
      e.id,
      e.amount_minutes,
      e.source,
      e.created_at,
      e.paid_out,
      m.name as partner_name,
      m.image_url as partner_image_url
    from public.bounty_earnings e
    left join public.members m on e.male_id = m.id
    where e.female_id = v_female_id
      and e.clawed_back = false
    order by e.created_at desc
    limit 10
  ) t;

  -- Get pending attributions
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_pending_logs
  from (
    select 
      a.id,
      m.name as partner_name,
      m.image_url as partner_image_url,
      a.last_interaction_at,
      a.expires_at,
      a.interaction_type
    from public.bounty_attributions a
    left join public.members m on a.male_id = m.id
    where a.female_id = v_female_id
      and a.expires_at >= now()
    order by a.last_interaction_at desc
    limit 10
  ) t;

  -- Build result
  v_result := jsonb_build_object(
    'total_minutes_earned', v_total_minutes,
    'total_usd_earned', v_total_usd,
    'active_links_count', v_active_links,
    'recent_logs', v_recent_logs,
    'pending_logs', v_pending_logs
  );

  return v_result;
end;
$function$;

alter function public.get_bounty_summary() owner to postgres;
revoke all on function public.get_bounty_summary() from public, anon;
grant execute on function public.get_bounty_summary() to authenticated;

create or replace function public.award_bounty_for_subscription(
  p_male_id uuid,
  p_tier text,
  p_stripe_subscription_id text,
  p_is_renewal boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_female_id uuid;
  v_amount_minutes integer;
  v_source text;
  v_last_streak_time timestamptz;
  v_subs_since_last_streak integer;
begin
  -- Find the latest active attribution for this male user
  select female_id into v_female_id
  from public.bounty_attributions
  where male_id = p_male_id and expires_at >= now()
  order by last_interaction_at desc
  limit 1;

  -- If no active attribution, do nothing and return false
  if v_female_id is null then
    return false;
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

  -- Calculate minutes based on tier/renewal/streak
  -- Basic VIP: 125 minutes. Premium VIP: 500 minutes. Renewal: 200 minutes.
  if v_source = 'renewal' then
    v_amount_minutes := 200;
  elsif v_source = 'premium' then
    v_amount_minutes := 500;
  else
    v_amount_minutes := 125;
  end if;

  -- Check if this bounty has already been credited (idempotency)
  if exists (
    select 1 from public.bounty_earnings
    where female_id = v_female_id
      and male_id = p_male_id
      and stripe_subscription_id = p_stripe_subscription_id
      and source = v_source
  ) then
    return false;
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

  -- Check for Streak bonus (3 in 7 days): +500 min bonus
  -- 1. Find the timestamp of the last streak bonus awarded to this female
  select coalesce(max(created_at), '1970-01-01'::timestamptz) into v_last_streak_time
  from public.bounty_earnings
  where female_id = v_female_id
    and source = 'streak';

  -- 2. Count non-streak bounty earnings for this female since that last streak bonus and within last 7 days
  select count(*) into v_subs_since_last_streak
  from public.bounty_earnings
  where female_id = v_female_id
    and source in ('basic', 'premium', 'renewal')
    and created_at > v_last_streak_time
    and created_at >= now() - interval '7 days';

  -- 3. If count >= 3, award streak bonus
  if v_subs_since_last_streak >= 3 then
    -- Check if streak bonus has already been credited for this specific subscription to ensure idempotency
    if not exists (
      select 1 from public.bounty_earnings
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

      -- Increment member_minutes.gifted_minutes for the female by another 500
      update public.member_minutes
      set gifted_minutes = coalesce(gifted_minutes, 0) + 500,
          updated_at = now()
      where user_id = v_female_id;
    end if;
  end if;

  return true;
end;
$function$;

alter function public.award_bounty_for_subscription(uuid, text, text, boolean) owner to postgres;
revoke all on function public.award_bounty_for_subscription(uuid, text, text, boolean) from public, anon;
grant execute on function public.award_bounty_for_subscription(uuid, text, text, boolean) to authenticated, service_role;

commit;