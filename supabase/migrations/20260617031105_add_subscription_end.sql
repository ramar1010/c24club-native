alter table public.member_minutes
  add column if not exists subscription_end timestamptz;

alter table public.iap_purchases
  add column if not exists original_transaction_id text;

alter table public.iap_purchases
  add column if not exists subscription_end timestamptz;