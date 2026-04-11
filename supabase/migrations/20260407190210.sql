-- Create the function that sends VIP gifting reminder notifications
CREATE OR REPLACE FUNCTION send_vip_gifting_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eligible_user RECORD;
  service_role_key TEXT;
  supabase_url TEXT;
BEGIN
  -- Get credentials from vault
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Loop through eligible non-Premium-VIP female users
  FOR eligible_user IN
    SELECT m.id
    FROM members m
    JOIN member_minutes mm ON mm.user_id = m.id
    WHERE m.gender = 'female'
      AND m.notify_enabled = true
      AND m.push_token IS NOT NULL
      AND mm.admin_granted_vip = false
      AND (mm.is_vip = false OR mm.vip_tier IS DISTINCT FROM 'premium')
  LOOP
    -- Call send-push-notification edge function for each user
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'user_id', eligible_user.id,
        'title', '💎 Become VIP to get gifts from guys!',
        'body', 'Upgrade to Premium VIP and guys can send you cash gifts directly. Tap to unlock gifting!',
        'data', jsonb_build_object(
          'screen', '/vip',
          'deepLink', '/vip',
          'channelId', 'promotions',
          'type', 'vip_gifting_reminder'
        ),
        'notification_type', 'vip_gifting_reminder',
        'cooldown_minutes', 10080
      )
    );
  END LOOP;
END;
$$;