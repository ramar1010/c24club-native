-- Grant execute to authenticated users so they can call it via the anon/authenticated client
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Revoke from anon just to be safe
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;