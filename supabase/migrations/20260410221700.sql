-- RPC: lets app check if current user is blocked by a specific partner
CREATE OR REPLACE FUNCTION public.is_blocked_by(partner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = partner_id
    AND blocked_id = auth.uid()
  );
$$;