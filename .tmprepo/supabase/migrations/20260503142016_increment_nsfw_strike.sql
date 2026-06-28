CREATE OR REPLACE FUNCTION public.increment_nsfw_strike(target_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.members
  SET nsfw_strike_count = COALESCE(nsfw_strike_count, 0) + 1
  WHERE id = target_user_id;
$$;

ALTER FUNCTION public.increment_nsfw_strike(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.increment_nsfw_strike(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_nsfw_strike(uuid) TO authenticated, service_role;