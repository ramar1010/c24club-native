CREATE POLICY "Users can update own minutes."
ON public.member_minutes
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);