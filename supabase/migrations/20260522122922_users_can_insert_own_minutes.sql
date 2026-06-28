CREATE POLICY "Users can insert own minutes." 
ON public.member_minutes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);