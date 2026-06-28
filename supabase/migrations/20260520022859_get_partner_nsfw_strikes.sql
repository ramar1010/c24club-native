CREATE OR REPLACE FUNCTION public.get_partner_nsfw_strikes(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  strikes integer;
BEGIN
  SELECT nsfw_strike_count INTO strikes
  FROM public.members
  WHERE id = target_user_id;

  RETURN COALESCE(strikes, 0);
END;
$$;

ALTER FUNCTION public.get_partner_nsfw_strikes(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO service_role;