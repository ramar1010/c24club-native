-- Create a function that deletes the auth user AND all their data
-- Uses SECURITY DEFINER so it runs with superuser-like privileges
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id uuid;
  result jsonb;
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
$$;