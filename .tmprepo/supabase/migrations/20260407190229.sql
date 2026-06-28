-- Schedule the VIP gifting reminder to run daily at 2 PM UTC
-- The 7-day cooldown in send-push-notification ensures each user gets at most 1 notification per week
SELECT cron.schedule(
  'vip-gifting-reminder',
  '0 14 * * *',
  'SELECT send_vip_gifting_reminders();'
);