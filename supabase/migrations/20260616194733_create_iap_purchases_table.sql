create table if not exists public.iap_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  sku text not null,
  action text,
  vip_tier text,
  purchase_token_hash text unique,
  created_at timestamptz not null default now()
);

revoke all on public.iap_purchases from public, anon;
grant select, insert on public.iap_purchases to authenticated;
grant select, insert, update, delete on public.iap_purchases to service_role;

alter table public.iap_purchases enable row level security;

create policy "Users can view their own iap purchases"
  on public.iap_purchases
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own iap purchases"
  on public.iap_purchases
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);