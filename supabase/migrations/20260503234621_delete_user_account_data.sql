CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get user email from members table before deletion
  SELECT email INTO user_email FROM public.members WHERE id = target_user_id;

  -- Delete from tables that reference the user ID
  DELETE FROM public.member_interests WHERE user_id = target_user_id OR interested_in_user_id = target_user_id;
  DELETE FROM public.gift_transactions WHERE sender_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.cashout_requests WHERE user_id = target_user_id;
  DELETE FROM public.user_bans WHERE user_id = target_user_id;
  DELETE FROM public.user_reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.push_notification_log WHERE user_id = target_user_id;
  DELETE FROM public.male_search_batch_log WHERE female_user_id = target_user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  
  -- Delete from tables that reference the email
  IF user_email IS NOT NULL THEN
    DELETE FROM public.email_send_log WHERE recipient_email = user_email;
  END IF;

  -- The following have ON DELETE CASCADE to members(id) or auth.users(id)
  -- but we'll delete them explicitly just in case or to be thorough
  DELETE FROM public.member_minutes WHERE user_id = target_user_id;
  DELETE FROM public.vip_settings WHERE user_id = target_user_id;
  
  -- Finally delete the member record
  DELETE FROM public.members WHERE id = target_user_id;
END;
$$;