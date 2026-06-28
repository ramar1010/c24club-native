update public.cashout_settings
set rate_per_minute = 0.005,
    updated_at = now()
where id = 1
returning *;