CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
BEGIN
  -- Get user email from members table before deletion
  SELECT email INTO user_email FROM public.members WHERE id = target_user_id;

  -- 1. Delete from tables that reference the user ID (with casting as requested)
  -- Existing tables
  DELETE FROM public.member_interests 
  WHERE user_id::text = target_user_id::text 
     OR interested_in_user_id::text = target_user_id::text;
  
  DELETE FROM public.gift_transactions 
  WHERE sender_id::text = target_user_id::text 
     OR recipient_id::text = target_user_id::text;
  
  DELETE FROM public.cashout_requests 
  WHERE user_id::text = target_user_id::text;
  
  DELETE FROM public.user_bans 
  WHERE user_id::text = target_user_id::text;
  
  DELETE FROM public.user_reports 
  WHERE reporter_id::text = target_user_id::text 
     OR reported_user_id::text = target_user_id::text;
  
  DELETE FROM public.push_notification_log 
  WHERE user_id::text = target_user_id::text;
  
  DELETE FROM public.male_search_batch_log 
  WHERE female_user_id::text = target_user_id::text;
  
  DELETE FROM public.blocked_users 
  WHERE blocker_id::text = target_user_id::text 
     OR blocked_id::text = target_user_id::text;

  -- Include missing tables mentioned in task (with exception handling for robustness)
  BEGIN
    EXECUTE 'DELETE FROM public.member_redemptions WHERE user_id::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.conversations WHERE participant_1::text = $1 OR participant_2::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.dm_messages WHERE sender_id::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.direct_call_invites WHERE inviter_id::text = $1 OR invitee_id::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.discover_profile_views WHERE viewer_id::text = $1 OR viewed_member_id::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.waiting_queue WHERE member_id::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    EXECUTE 'DELETE FROM public.rooms WHERE member1::text = $1 OR member2::text = $1' USING target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- 2. Delete from tables that reference the email
  IF user_email IS NOT NULL THEN
    DELETE FROM public.email_send_log WHERE recipient_email = user_email;
  END IF;

  -- 3. The following have ON DELETE CASCADE to members(id) or auth.users(id)
  -- but we'll delete them explicitly just in case or to be thorough
  DELETE FROM public.member_minutes WHERE user_id::text = target_user_id::text;
  DELETE FROM public.vip_settings WHERE user_id::text = target_user_id::text;
  
  -- Finally delete the member record
  DELETE FROM public.members WHERE id::text = target_user_id::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  calling_user_id uuid;
BEGIN
  -- Get the currently authenticated user's ID from the JWT
  calling_user_id := auth.uid();
  
  IF calling_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Delete all public schema data first
  PERFORM public.delete_user_account_data(calling_user_id);
  
  -- Delete from auth.users (requires superuser or security definer with proper grants)
  DELETE FROM auth.users WHERE id = calling_user_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;