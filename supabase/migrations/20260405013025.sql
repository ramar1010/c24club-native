CREATE TABLE IF NOT EXISTS push_notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);