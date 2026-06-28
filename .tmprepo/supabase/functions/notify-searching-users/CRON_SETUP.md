# pg_cron Setup for `notify-searching-users`

Run the following SQL in your **Supabase SQL Editor** (Database → SQL Editor → New query).

## Step 1 — Enable required extensions (run once)

```sql
-- pg_cron: scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net: makes HTTP requests from SQL
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Step 2 — Store your service role key as a database setting (run once)

```sql
-- Replace <YOUR_SERVICE_ROLE_KEY> with the key from Supabase → Settings → API
ALTER DATABASE postgres
  SET app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
```

> **Security note:** This key is stored in the database config, not in plaintext in your SQL
> history. Only superusers can read it via `current_setting(...)`.

## Step 3 — Schedule the cron job

```sql
-- Schedule notify-searching-users every 5 minutes
SELECT cron.schedule(
  'notify-searching-users',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-searching-users',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer '
                || current_setting('app.service_role_key', true)
                || '"}')::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```

## Verify the schedule

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'notify-searching-users';
```

## Remove the schedule (if needed)

```sql
SELECT cron.unschedule('notify-searching-users');
```