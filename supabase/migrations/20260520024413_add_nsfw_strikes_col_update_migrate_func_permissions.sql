-- Add nsfw_strikes to member_minutes if it doesn't exist
ALTER TABLE public.member_minutes 
ADD COLUMN IF NOT EXISTS nsfw_strikes integer NOT NULL DEFAULT 0;

-- Migrate existing data from members.nsfw_strike_count to member_minutes.nsfw_strikes
-- This assumes member_minutes rows exist for all members (which they should in this app)
UPDATE public.member_minutes mm
SET nsfw_strikes = m.nsfw_strike_count
FROM public.members m
WHERE mm.user_id = m.id
AND m.nsfw_strike_count > 0;

-- Drop the old function to change parameter name
DROP FUNCTION IF EXISTS public.get_partner_nsfw_strikes(uuid);

-- Create the updated function
CREATE OR REPLACE FUNCTION public.get_partner_nsfw_strikes(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  strikes integer;
BEGIN
  SELECT nsfw_strikes INTO strikes
  FROM public.member_minutes
  WHERE user_id = _user_id;

  RETURN COALESCE(strikes, 0);
END;
$$;

-- Ensure proper permissions
ALTER FUNCTION public.get_partner_nsfw_strikes(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO service_role;