-- Add streak columns to member_minutes
alter table if exists public.member_minutes
  add column if not exists login_streak integer not null default 0,
  add column if not exists last_streak_login_at timestamptz;

-- Add notes to cashout_requests for support/admin tracking
alter table if exists public.cashout_requests
  add column if not exists notes text;

-- Create member_redemptions if it is still missing
create table if not exists public.member_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  reward_id uuid not null,
  reward_title text not null,
  reward_image_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  cashout_amount numeric,
  cashout_paypal text,
  cashout_status text,
  shipping_name text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  shipping_tracking_url text,
  notes text,
  -- Compatibility columns used by the current app code
  reward_rarity text,
  reward_type text,
  selected_color text,
  minutes_cost numeric
);

-- Preserve realtime delivery for redemption updates so the existing listener sees status changes.
alter table if exists public.member_redemptions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication p
    join pg_publication_rel pr on pr.prpubid = p.oid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'member_redemptions'
  ) then
    alter publication supabase_realtime add table public.member_redemptions;
  end if;
end $$;

-- Data API / GraphQL-style privileges: revoke broad defaults, then grant explicit access.
revoke all on public.member_minutes from public, anon, authenticated, service_role;
grant select, insert, update on public.member_minutes to authenticated;
grant select, insert, update, delete on public.member_minutes to service_role;

revoke all on public.cashout_requests from public, anon, authenticated, service_role;
grant select on public.cashout_requests to authenticated;
grant select, insert, update, delete on public.cashout_requests to service_role;

revoke all on public.member_redemptions from public, anon, authenticated, service_role;
grant select, insert, update on public.member_redemptions to authenticated;
grant select, insert, update, delete on public.member_redemptions to service_role;

-- RLS stays enabled and explicit for each user-owned table.
alter table if exists public.member_minutes enable row level security;
alter table if exists public.cashout_requests enable row level security;
alter table if exists public.member_redemptions enable row level security;

drop policy if exists "Users can view own minutes." on public.member_minutes;
create policy "Users can view own minutes."
  on public.member_minutes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own minutes." on public.member_minutes;
create policy "Users can insert own minutes."
  on public.member_minutes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own minutes." on public.member_minutes;
create policy "Users can update own minutes."
  on public.member_minutes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own cashout requests." on public.cashout_requests;
create policy "Users can view own cashout requests."
  on public.cashout_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own cashout requests." on public.cashout_requests;

drop policy if exists "Users can view own redemptions." on public.member_redemptions;
create policy "Users can view own redemptions."
  on public.member_redemptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own redemptions." on public.member_redemptions;
create policy "Users can insert own redemptions."
  on public.member_redemptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own redemptions." on public.member_redemptions;
create policy "Users can update own redemptions."
  on public.member_redemptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);