CREATE OR REPLACE FUNCTION public.get_user_free_msg_status(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_vip boolean;
  v_used_count integer;
  v_has_reached_limit boolean;
  v_result jsonb;
BEGIN
  -- 1. Check if user is VIP (either is_vip flag or admin_granted_vip flag is true)
  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false)
  INTO v_is_vip
  FROM public.member_minutes
  WHERE user_id = target_user_id;

  v_is_vip := COALESCE(v_is_vip, false);

  -- 2. Count messages sent to female members
  SELECT COUNT(*)::integer
  INTO v_used_count
  FROM public.dm_messages m 
  JOIN public.conversations c ON m.conversation_id = c.id
  JOIN public.members partner ON (CASE WHEN c.participant_1 = m.sender_id THEN c.participant_2 ELSE c.participant_1 END) = partner.id
  WHERE m.sender_id = target_user_id 
  AND lower(partner.gender) = 'female';

  v_used_count := COALESCE(v_used_count, 0);

  -- 3. Determine if they reached the limit (non-VIP with 3 or more messages)
  v_has_reached_limit := (NOT v_is_vip) AND (v_used_count >= 3);

  -- 4. Build the jsonb result
  v_result := jsonb_build_object(
    'is_vip', v_is_vip,
    'used_count', v_used_count,
    'has_reached_limit', v_has_reached_limit
  );

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_user_free_msg_status(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_user_free_msg_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_free_msg_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_free_msg_status(uuid) TO service_role;