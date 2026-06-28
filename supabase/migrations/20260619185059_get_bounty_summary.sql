CREATE OR REPLACE FUNCTION public.get_bounty_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_female_id uuid;
  v_total_minutes integer;
  v_total_usd numeric;
  v_active_links integer;
  v_recent_logs jsonb;
  v_pending_logs jsonb;
  v_result jsonb;
BEGIN
  -- Get caller ID
  v_female_id := auth.uid();
  IF v_female_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate total minutes
  SELECT COALESCE(SUM(amount_minutes), 0)
  INTO v_total_minutes
  FROM public.bounty_earnings
  WHERE female_id = v_female_id AND clawed_back = false;

  -- Calculate total USD using a hardcoded rate of 0.01
  v_total_usd := v_total_minutes * 0.01;

  -- Count active links
  SELECT COUNT(*)
  INTO v_active_links
  FROM public.bounty_attributions
  WHERE female_id = v_female_id AND expires_at >= now();

  -- Get recent logs (latest 10 logs)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_recent_logs
  FROM (
    SELECT 
      e.id,
      e.amount_minutes,
      e.source,
      e.created_at,
      e.paid_out,
      m.name as partner_name,
      m.image_url as partner_image_url
    FROM public.bounty_earnings e
    LEFT JOIN public.members m ON e.male_id = m.id
    WHERE e.female_id = v_female_id
      AND e.clawed_back = false
    ORDER BY e.created_at DESC
    LIMIT 10
  ) t;

  -- Get pending attributions
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_pending_logs
  FROM (
    SELECT 
      a.id,
      m.name as partner_name,
      m.image_url as partner_image_url,
      a.last_interaction_at,
      a.expires_at,
      a.interaction_type
    FROM public.bounty_attributions a
    LEFT JOIN public.members m ON a.male_id = m.id
    WHERE a.female_id = v_female_id
      AND a.expires_at >= now()
    ORDER BY a.last_interaction_at DESC
    LIMIT 10
  ) t;

  -- Build result
  v_result := jsonb_build_object(
    'total_minutes_earned', v_total_minutes,
    'total_usd_earned', v_total_usd,
    'active_links_count', v_active_links,
    'recent_logs', v_recent_logs,
    'pending_logs', v_pending_logs
  );

  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.get_bounty_summary() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_bounty_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_bounty_summary() TO authenticated;