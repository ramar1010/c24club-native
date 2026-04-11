-- Fix: Prevent blocked users from sending DMs
-- Apply this migration on the Lovable Supabase project (ncpbiymnafxdfsvpxirb)

-- RLS policy: prevent a blocked user from inserting messages
-- A user cannot send a message if the recipient has them in blocked_users
CREATE POLICY "Blocked users cannot send messages"
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE blocker_id = (
        SELECT CASE
          WHEN participant_1 = auth.uid() THEN participant_2
          ELSE participant_1
        END
        FROM public.conversations
        WHERE id = conversation_id
        LIMIT 1
      )
      AND blocked_id = auth.uid()
    )
  );

-- RPC: lets the app check if the current user has been blocked by a specific partner
-- Uses SECURITY DEFINER so it can bypass RLS (users can't see who blocked them)
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