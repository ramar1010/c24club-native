CREATE OR REPLACE FUNCTION public.get_partner_pinned_socials(p_partner_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_vip boolean := false;
  v_socials text[];
BEGIN
  SELECT (is_vip = true OR admin_granted_vip = true)
  INTO v_is_vip
  FROM member_minutes
  WHERE user_id = p_partner_id;

  IF NOT FOUND OR NOT v_is_vip THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT pinned_socials
  INTO v_socials
  FROM vip_settings
  WHERE user_id = p_partner_id;

  RETURN COALESCE(v_socials, ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_pinned_socials(uuid) TO authenticated;