alter table public.bounty_earnings
  drop constraint if exists bounty_earnings_male_id_fkey;

alter table public.bounty_earnings
  add constraint bounty_earnings_male_id_fkey
  foreign key (male_id)
  references public.members(id);