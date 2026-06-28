CREATE OR REPLACE FUNCTION public.increment_nsfw_strike(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We now use member_minutes.nsfw_strikes as the source of truth
  UPDATE public.member_minutes
  SET nsfw_strikes = COALESCE(nsfw_strikes, 0) + 1
  WHERE user_id = target_user_id;

  -- Ensure we also increment the legacy counter for compatibility if needed, 
  -- or we could just remove it. For now, let's keep both in sync to be safe
  -- unless we are sure we want to move entirely.
  -- Given the "confirm location" instruction, moving is likely the goal.
  
  UPDATE public.members
  SET nsfw_strike_count = COALESCE(nsfw_strike_count, 0) + 1
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION public.increment_nsfw_strike(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.increment_nsfw_strike(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_nsfw_strike(uuid) TO authenticated, service_role;